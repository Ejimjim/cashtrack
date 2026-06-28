'use strict';

require('dotenv').config();

const { TelegramBot } = require('node-telegram-bot-api');
const db            = require('./db');
const { interpret } = require('./interpreter');
const { todaySummary, weekSummary, weekComparison, runningBalance, topCategories } = require('./cashflow');
const { todayInsight, weekInsights, balanceInsight } = require('./insights');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

const WELCOME = `Welcome to CashTrack! 👋

Just type what happened and I will save it for you.

── Recording a sale ──────────────────────
Use a selling word, then the item and amount:

  sold rice 3500
  sold chicken 4000
  received 8000 from customer

── Recording an expense ──────────────────
Use a spending word, then the item and amount:

  paid rent 20000
  bought stock 5000
  paid transport 800

── Several items in one message ──────────
List them separated by commas or lines:

  sold fish 3000, gaz 4000, turkey 7000

One selling word covers everything that follows.
Switch action word to switch type:

  sold fish 3000, gaz 4000, paid transport 500

  → fish and gaz are sales
  → transport is an expense

── Always check what I recorded ──────────
I will show every item I saved. Check that each
line is correct before you move on:

  ✓ Sale — fish N3,000
  ✓ Sale — gaz N4,000
  ✓ Expense — transport N500

── Check your figures any time ───────────
  today       — today's sales, expenses, and net
  this week   — last 7 days and comparison
  balance     — all-time running total

── Remove a wrong entry ──────────────────
To remove an entry, open the dashboard
and use the 🗑 button in History.`;

// ── Undo ──────────────────────────────────────────────────────────────────────

const UNDO_RE = /^\s*(undo|delete last|cancel last|remove last)\s*$/i;

function handleUndo(chatId) {
  const last = db.prepare(`
    SELECT
      tx.transaction_id AS id,
      t.type_name       AS type,
      c.category_name   AS category,
      tx.amount,
      tx.txn_date       AS date
    FROM transactions tx
    JOIN transaction_type t ON t.type_id     = tx.type_id
    JOIN category c         ON c.category_id = tx.category_id
    ORDER BY tx.created_at DESC, tx.transaction_id DESC
    LIMIT 1
  `).get();

  if (!last) {
    return bot.sendMessage(chatId, 'Nothing to undo — no transactions recorded yet.');
  }

  db.prepare('DELETE FROM transactions WHERE transaction_id = ?').run(last.id);

  const label = last.type === 'sale' ? 'Sale' : 'Expense';
  const now   = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const totals = db.prepare(`
    SELECT
      SUM(CASE WHEN t.type_name = 'sale'    THEN tx.amount ELSE 0 END) AS sales,
      SUM(CASE WHEN t.type_name = 'expense' THEN tx.amount ELSE 0 END) AS expenses
    FROM transactions tx
    JOIN transaction_type t ON t.type_id = tx.type_id
    WHERE tx.txn_date = @today
  `).get({ today });

  const sales    = totals.sales    || 0;
  const expenses = totals.expenses || 0;
  const net      = sales - expenses;
  const netLine  = net >= 0
    ? `Up N${net.toLocaleString()} today`
    : `Down N${Math.abs(net).toLocaleString()} today`;

  const reply = [
    `Removed: ${label} — ${last.category} N${Number(last.amount).toLocaleString()}`,
    '',
    'Today',
    `  Sales    : N${sales.toLocaleString()}`,
    `  Expenses : N${expenses.toLocaleString()}`,
    `  ${netLine}`,
  ].join('\n');

  bot.sendMessage(chatId, reply);
}

// ── Query detection ────────────────────────────────────────────────────────────

const TRANSACTION_VERB = /\b(sold|paid|bought|spent|received|got|collected|purchased)\b/i;

function detectQuery(text) {
  const t = text.trim();
  if (TRANSACTION_VERB.test(t)) return null;
  if (/\btoday\b|\bhow much.*today\b|\bdid i make\b/i.test(t))          return 'today';
  if (/\bthis week\b|\blast 7 days\b|\bweekly\b|\bweek\b/i.test(t))    return 'week';
  if (/\bbalance\b|\ball.?time\b|\ball time\b|\brunning total\b/i.test(t)) return 'balance';
  return null;
}

// ── Query reply builders ───────────────────────────────────────────────────────

function fmt(n) {
  return `N${Math.round(n).toLocaleString()}`;
}

function replyToday() {
  const s = todaySummary();
  const insight = todayInsight(s);
  return [
    'Today',
    `  Sales    : ${fmt(s.sales)}`,
    `  Expenses : ${fmt(s.expenses)}`,
    `  Net      : ${s.net >= 0 ? '+' : ''}${fmt(s.net)}`,
    '',
    insight,
  ].join('\n');
}

function replyWeek() {
  const s   = weekSummary();
  const cmp = weekComparison();
  const top = topCategories();
  const ins = weekInsights(s, cmp, top);

  const lines = [
    'Last 7 days',
    `  Sales    : ${fmt(s.sales)}`,
    `  Expenses : ${fmt(s.expenses)}`,
    `  Net      : ${s.net >= 0 ? '+' : ''}${fmt(s.net)}`,
  ];

  if (top.sales.length > 0) {
    lines.push('');
    lines.push('Top sales');
    top.sales.forEach(r => lines.push(`  ${r.category} ${fmt(r.total)}`));
  }

  if (top.expenses.length > 0) {
    lines.push('');
    lines.push('Top expenses');
    top.expenses.forEach(r => lines.push(`  ${r.category} ${fmt(r.total)}`));
  }

  if (ins.length > 0) {
    lines.push('');
    ins.forEach(i => lines.push(i));
  }

  return lines.join('\n');
}

function replyBalance() {
  const data = runningBalance();
  const insight = balanceInsight(data);
  return [
    'All-time balance',
    `  Total sales    : ${fmt(data.sales)}`,
    `  Total expenses : ${fmt(data.expenses)}`,
    `  Balance        : ${data.balance >= 0 ? '+' : ''}${fmt(data.balance)}`,
    '',
    insight,
  ].join('\n');
}

// ── Bot handlers ───────────────────────────────────────────────────────────────

bot.onText(/^\/(start|help)$/, (msg) => {
  bot.sendMessage(msg.chat.id, WELCOME);
});

bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;

  try {
    if (UNDO_RE.test(msg.text)) {
      return handleUndo(chatId);
    }

    const query = detectQuery(msg.text);

    if (query === 'today') {
      return bot.sendMessage(chatId, replyToday());
    }
    if (query === 'week') {
      return bot.sendMessage(chatId, replyWeek());
    }
    if (query === 'balance') {
      return bot.sendMessage(chatId, replyBalance());
    }

    // ── Record transaction(s) ────────────────────────────────────────────────

    const { transactions, unclear } = await interpret(msg.text);

    if (transactions.length === 0 && unclear.length === 0) {
      return bot.sendMessage(
        chatId,
        `I could not figure that out. Please include an action word and an amount.\n\nExamples:\n  "sold rice 3500"\n  "paid transport 500"`
      );
    }

    const now   = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const confirmLines = [];

    for (const txn of transactions) {
      const typeRow = db
        .prepare('SELECT type_id FROM transaction_type WHERE type_name = ?')
        .get(txn.type);
      if (!typeRow) continue;

      let catRow = db
        .prepare('SELECT category_id FROM category WHERE type_id = ? AND category_name = ?')
        .get(typeRow.type_id, txn.category);

      if (!catRow) {
        const ins = db
          .prepare('INSERT INTO category (type_id, category_name) VALUES (?, ?)')
          .run(typeRow.type_id, txn.category);
        catRow = { category_id: ins.lastInsertRowid };
      }

      db.prepare(`
        INSERT INTO transactions (type_id, category_id, amount, note, txn_date, source)
        VALUES (?, ?, ?, ?, ?, 'telegram')
      `).run(typeRow.type_id, catRow.category_id, txn.amount, txn.note || null, today);

      const label = txn.type === 'sale' ? 'Sale' : 'Expense';
      confirmLines.push(`✓ ${label} — ${txn.category} N${Number(txn.amount).toLocaleString()}`);
    }

    const totals = db.prepare(`
      SELECT
        SUM(CASE WHEN t.type_name = 'sale'    THEN tx.amount ELSE 0 END) AS sales,
        SUM(CASE WHEN t.type_name = 'expense' THEN tx.amount ELSE 0 END) AS expenses
      FROM transactions tx
      JOIN transaction_type t ON t.type_id = tx.type_id
      WHERE tx.txn_date = @today
    `).get({ today });

    const sales    = totals.sales    || 0;
    const expenses = totals.expenses || 0;
    const net      = sales - expenses;
    const netLine  = net >= 0
      ? `Up N${net.toLocaleString()} today`
      : `Down N${Math.abs(net).toLocaleString()} today`;

    const replyLines = [...confirmLines];

    if (unclear.length > 0) {
      replyLines.push('');
      replyLines.push('Could not interpret:');
      unclear.forEach(f => replyLines.push(`  ? ${f}`));
      replyLines.push('Please re-send those with an action word and amount.');
    }

    replyLines.push('');
    replyLines.push('Today');
    replyLines.push(`  Sales    : N${sales.toLocaleString()}`);
    replyLines.push(`  Expenses : N${expenses.toLocaleString()}`);
    replyLines.push(`  ${netLine}`);

    bot.sendMessage(chatId, replyLines.join('\n'));

  } catch (err) {
    console.error('[bot] error:', err.message);
    bot.sendMessage(chatId, 'Something went wrong. Please try again in a moment.');
  }
});

console.log('CashTrack bot started. Waiting for messages...');
