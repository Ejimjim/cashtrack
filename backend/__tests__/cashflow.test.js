'use strict';

// jest.mock is hoisted before all imports, so the factory must be self-contained.
// We create an in-memory SQLite database that mirrors the real schema exactly.
jest.mock('../db', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');

  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE transaction_type (
      type_id   INTEGER PRIMARY KEY,
      type_name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE category (
      category_id   INTEGER PRIMARY KEY,
      type_id       INTEGER NOT NULL REFERENCES transaction_type(type_id),
      category_name TEXT NOT NULL
    );
    CREATE TABLE transactions (
      transaction_id INTEGER PRIMARY KEY,
      type_id        INTEGER NOT NULL REFERENCES transaction_type(type_id),
      category_id    INTEGER NOT NULL REFERENCES category(category_id),
      amount         NUMERIC NOT NULL,
      note           TEXT,
      txn_date       DATE NOT NULL,
      source         TEXT,
      created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO transaction_type VALUES (1, 'sale');
    INSERT INTO transaction_type VALUES (2, 'expense');
  `);

  return db;
});

const db = require('../db');
const { todaySummary, weekSummary, weekComparison, runningBalance, topCategories } = require('../cashflow');

// Same date algorithm used by cashflow.js itself
function localDate(daysBack = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Insert a transaction, auto-creating the category row if it doesn't exist yet
function insert({ type = 'sale', category = 'test', amount, date = localDate(0) }) {
  const typeId = type === 'sale' ? 1 : 2;
  let cat = db.prepare(
    'SELECT category_id FROM category WHERE type_id = ? AND category_name = ?'
  ).get(typeId, category);
  if (!cat) {
    const r = db.prepare('INSERT INTO category (type_id, category_name) VALUES (?, ?)').run(typeId, category);
    cat = { category_id: r.lastInsertRowid };
  }
  db.prepare(
    'INSERT INTO transactions (type_id, category_id, amount, txn_date, source) VALUES (?, ?, ?, ?, ?)'
  ).run(typeId, cat.category_id, amount, date, 'test');
}

// Wipe data between tests; transaction_type rows stay (they never change)
beforeEach(() => {
  db.exec('DELETE FROM transactions; DELETE FROM category;');
});

// ─────────────────────────────────────────────────────────────────────────────
// todaySummary
// ─────────────────────────────────────────────────────────────────────────────

describe('todaySummary', () => {
  test('empty day returns zeros, not errors', () => {
    expect(todaySummary()).toEqual({ sales: 0, expenses: 0, net: 0 });
  });

  test('sales only — expenses and are zero, net equals sales', () => {
    insert({ type: 'sale', amount: 3000 });
    insert({ type: 'sale', amount: 4000 });
    const r = todaySummary();
    expect(r.sales).toBe(7000);
    expect(r.expenses).toBe(0);
    expect(r.net).toBe(7000);
  });

  test('expenses only — sales are zero, net is negative', () => {
    insert({ type: 'expense', amount: 2000 });
    insert({ type: 'expense', amount: 5000 });
    const r = todaySummary();
    expect(r.sales).toBe(0);
    expect(r.expenses).toBe(7000);
    expect(r.net).toBe(-7000);
  });

  test('normal day — correct totals and net for mixed transactions', () => {
    insert({ type: 'sale',    amount: 10000 });
    insert({ type: 'sale',    amount:  5000 });
    insert({ type: 'expense', amount:  3000 });
    const r = todaySummary();
    expect(r.sales).toBe(15000);
    expect(r.expenses).toBe(3000);
    expect(r.net).toBe(12000);
  });

  test('does not include transactions from yesterday', () => {
    insert({ type: 'sale', amount: 9000, date: localDate(1) }); // yesterday
    insert({ type: 'sale', amount: 1000, date: localDate(0) }); // today
    expect(todaySummary().sales).toBe(1000);
  });

  test('does not include transactions from a future date', () => {
    // Manually insert a future date (edge-case guard)
    const tomorrow = localDate(-1);
    insert({ type: 'sale', amount: 5000, date: tomorrow });
    expect(todaySummary().sales).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// runningBalance
// ─────────────────────────────────────────────────────────────────────────────

describe('runningBalance', () => {
  test('empty database returns zeros', () => {
    expect(runningBalance()).toEqual({ sales: 0, expenses: 0, balance: 0 });
  });

  test('sums all sales across all dates', () => {
    insert({ type: 'sale', amount: 5000,  date: localDate(30) });
    insert({ type: 'sale', amount: 8000,  date: localDate(0)  });
    const r = runningBalance();
    expect(r.sales).toBe(13000);
    expect(r.balance).toBe(13000);
  });

  test('all-time balance equals total sales minus total expenses', () => {
    insert({ type: 'sale',    amount: 20000, date: localDate(10) });
    insert({ type: 'expense', amount:  8000, date: localDate(5)  });
    insert({ type: 'expense', amount:  3000, date: localDate(0)  });
    const r = runningBalance();
    expect(r.sales).toBe(20000);
    expect(r.expenses).toBe(11000);
    expect(r.balance).toBe(9000);
  });

  test('balance is negative when lifetime expenses exceed lifetime sales', () => {
    insert({ type: 'sale',    amount: 5000 });
    insert({ type: 'expense', amount: 8000 });
    expect(runningBalance().balance).toBe(-3000);
  });

  test('includes transactions from every date, not just this week', () => {
    insert({ type: 'sale', amount: 1000, date: localDate(60) });
    insert({ type: 'sale', amount: 1000, date: localDate(30) });
    insert({ type: 'sale', amount: 1000, date: localDate(0)  });
    expect(runningBalance().sales).toBe(3000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// weekSummary
// ─────────────────────────────────────────────────────────────────────────────

describe('weekSummary', () => {
  test('returns zeros when no transactions', () => {
    expect(weekSummary()).toEqual({ sales: 0, expenses: 0, net: 0 });
  });

  test('includes today (day 0) in the window', () => {
    insert({ type: 'sale', amount: 5000, date: localDate(0) });
    expect(weekSummary().sales).toBe(5000);
  });

  test('includes the boundary day 6 days ago', () => {
    insert({ type: 'sale', amount: 4000, date: localDate(6) });
    expect(weekSummary().sales).toBe(4000);
  });

  test('excludes transactions exactly 7 days ago', () => {
    insert({ type: 'sale', amount: 9000, date: localDate(7) });
    expect(weekSummary().sales).toBe(0);
  });

  test('excludes transactions older than 7 days', () => {
    insert({ type: 'sale', amount: 9000, date: localDate(14) });
    insert({ type: 'sale', amount: 1000, date: localDate(0)  });
    expect(weekSummary().sales).toBe(1000);
  });

  test('sums correctly across multiple days within the window', () => {
    insert({ type: 'sale',    amount: 8000, date: localDate(1) });
    insert({ type: 'expense', amount: 3000, date: localDate(2) });
    insert({ type: 'sale',    amount: 2000, date: localDate(4) });
    const r = weekSummary();
    expect(r.sales).toBe(10000);
    expect(r.expenses).toBe(3000);
    expect(r.net).toBe(7000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// weekComparison
// ─────────────────────────────────────────────────────────────────────────────

describe('weekComparison', () => {
  test('returns zeros when no data exists', () => {
    const r = weekComparison();
    expect(r).toEqual({ thisNet: 0, prevNet: 0, difference: 0 });
  });

  test('difference is positive when this week is better than last', () => {
    // This week (days 0–6): net = +5000
    insert({ type: 'sale',    amount: 8000, date: localDate(1) });
    insert({ type: 'expense', amount: 3000, date: localDate(2) });
    // Previous week (days 7–13): net = +2000
    insert({ type: 'sale',    amount: 5000, date: localDate(8)  });
    insert({ type: 'expense', amount: 3000, date: localDate(10) });
    const r = weekComparison();
    expect(r.thisNet).toBe(5000);
    expect(r.prevNet).toBe(2000);
    expect(r.difference).toBe(3000);
  });

  test('difference is negative when this week is worse than last', () => {
    // This week: net = −2000
    insert({ type: 'sale',    amount: 3000, date: localDate(1) });
    insert({ type: 'expense', amount: 5000, date: localDate(2) });
    // Previous week: net = +4000
    insert({ type: 'sale',    amount: 6000, date: localDate(8)  });
    insert({ type: 'expense', amount: 2000, date: localDate(10) });
    const r = weekComparison();
    expect(r.thisNet).toBe(-2000);
    expect(r.prevNet).toBe(4000);
    expect(r.difference).toBe(-6000);
  });

  test('transactions outside both windows do not affect comparison', () => {
    insert({ type: 'sale', amount: 99000, date: localDate(14) }); // older than both windows
    insert({ type: 'sale', amount:  2000, date: localDate(0)  }); // this week only
    const r = weekComparison();
    expect(r.thisNet).toBe(2000);
    expect(r.prevNet).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// topCategories
// ─────────────────────────────────────────────────────────────────────────────

describe('topCategories', () => {
  test('returns empty arrays when no transactions', () => {
    const r = topCategories();
    expect(r.sales).toEqual([]);
    expect(r.expenses).toEqual([]);
  });

  test('separates sale and expense categories into their respective lists', () => {
    insert({ type: 'sale',    category: 'chicken', amount: 5000 });
    insert({ type: 'expense', category: 'rent',    amount: 8000 });
    const r = topCategories();
    expect(r.sales.length).toBe(1);
    expect(r.sales[0].category).toBe('chicken');
    expect(r.expenses.length).toBe(1);
    expect(r.expenses[0].category).toBe('rent');
  });

  test('orders categories by total descending', () => {
    insert({ type: 'sale', category: 'rice',    amount: 2000 });
    insert({ type: 'sale', category: 'chicken', amount: 7000 });
    insert({ type: 'sale', category: 'fish',    amount: 4000 });
    const r = topCategories();
    expect(r.sales[0].category).toBe('chicken');
    expect(r.sales[1].category).toBe('fish');
    expect(r.sales[2].category).toBe('rice');
  });

  test('aggregates multiple transactions of the same category', () => {
    insert({ type: 'sale', category: 'chicken', amount: 3000 });
    insert({ type: 'sale', category: 'chicken', amount: 4000 });
    const r = topCategories();
    expect(r.sales).toHaveLength(1);
    expect(r.sales[0].total).toBe(7000);
  });

  test('limits results to the top 3 per type', () => {
    ['a', 'b', 'c', 'd'].forEach((cat, i) =>
      insert({ type: 'sale', category: cat, amount: (4 - i) * 1000 })
    );
    expect(topCategories().sales).toHaveLength(3);
  });

  test('excludes transactions from outside the 7-day window', () => {
    insert({ type: 'sale', category: 'old', amount: 9000, date: localDate(8) });
    insert({ type: 'sale', category: 'new', amount: 1000, date: localDate(0) });
    const r = topCategories();
    expect(r.sales).toHaveLength(1);
    expect(r.sales[0].category).toBe('new');
  });

  test('the total field reflects the correct sum per category', () => {
    insert({ type: 'expense', category: 'transport', amount: 800  });
    insert({ type: 'expense', category: 'transport', amount: 1200 });
    insert({ type: 'expense', category: 'rent',      amount: 5000 });
    const r = topCategories();
    const transport = r.expenses.find(e => e.category === 'transport');
    expect(transport.total).toBe(2000);
  });
});
