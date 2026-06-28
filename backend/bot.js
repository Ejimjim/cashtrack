'use strict';

require('dotenv').config();

const { TelegramBot } = require('node-telegram-bot-api');
const db            = require('./db');
const { interpret } = require('./interpreter');
const { todaySummary, weekSummary, weekComparison, runningBalance, topCategories } = require('./cashflow');
const { todayInsight, weekInsights, balanceInsight } = require('./insights');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

const WELCOME = `Welcome to CashTrack!

Record transactions by typing what happened:
  sold chicken 4000
  sold rice 3500, paid transport 800
  sold fish 2500 paid rent 20000 bought stock 15000

Ask for your figures:
  today       — today's sales, expenses, and net
  this week   — last 7 days with comparison to prior week
  balance     — all-time running total

I will handle the rest.`;

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
