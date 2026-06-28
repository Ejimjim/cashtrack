'use strict';

const db = require('./db');

function localDate(daysBack = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function totalsForRange(start, end) {
  const row = db.prepare(`
    SELECT
      SUM(CASE WHEN t.type_name = 'sale'    THEN tx.amount ELSE 0 END) AS sales,
      SUM(CASE WHEN t.type_name = 'expense' THEN tx.amount ELSE 0 END) AS expenses
    FROM transactions tx
    JOIN transaction_type t ON t.type_id = tx.type_id
    WHERE tx.txn_date BETWEEN @start AND @end
  `).get({ start, end });
  const sales    = row.sales    || 0;
  const expenses = row.expenses || 0;
  return { sales, expenses, net: sales - expenses };
}

function todaySummary() {
  const today = localDate(0);
  return totalsForRange(today, today);
}

function weekSummary() {
  return totalsForRange(localDate(6), localDate(0));
}

function weekComparison() {
  const current  = weekSummary();
  const previous = totalsForRange(localDate(13), localDate(7));
  return {
    thisNet:    current.net,
    prevNet:    previous.net,
    difference: current.net - previous.net,
  };
}

function runningBalance() {
  const row = db.prepare(`
    SELECT
      SUM(CASE WHEN t.type_name = 'sale'    THEN tx.amount ELSE 0 END) AS sales,
      SUM(CASE WHEN t.type_name = 'expense' THEN tx.amount ELSE 0 END) AS expenses
    FROM transactions tx
    JOIN transaction_type t ON t.type_id = tx.type_id
  `).get();
  const sales    = row.sales    || 0;
  const expenses = row.expenses || 0;
  return { sales, expenses, balance: sales - expenses };
}

function topCategories() {
  const rows = db.prepare(`
    SELECT
      t.type_name     AS type,
      c.category_name AS category,
      SUM(tx.amount)  AS total
    FROM transactions tx
    JOIN transaction_type t ON t.type_id  = tx.type_id
    JOIN category c         ON c.category_id = tx.category_id
    WHERE tx.txn_date BETWEEN @start AND @end
    GROUP BY tx.category_id
    ORDER BY total DESC
  `).all({ start: localDate(6), end: localDate(0) });

  return {
    sales:    rows.filter(r => r.type === 'sale').slice(0, 3),
    expenses: rows.filter(r => r.type === 'expense').slice(0, 3),
  };
}

module.exports = { todaySummary, weekSummary, weekComparison, runningBalance, topCategories };
