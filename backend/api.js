'use strict';

require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const db      = require('./db');
const { todaySummary, weekSummary, weekComparison, runningBalance, topCategories } = require('./cashflow');
const { todayInsight, weekInsights, balanceInsight } = require('./insights');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

function handle(res, fn) {
  try {
    res.json(fn());
  } catch (err) {
    console.error('[api]', err.message);
    res.status(500).json({ error: err.message });
  }
}

app.get('/api/today', (req, res) => handle(res, todaySummary));

app.get('/api/week', (req, res) => handle(res, () => ({
  summary:    weekSummary(),
  comparison: weekComparison(),
  top:        topCategories(),
})));

app.get('/api/balance', (req, res) => handle(res, runningBalance));

app.get('/api/history', (req, res) => handle(res, () =>
  db.prepare(`
    SELECT
      tx.transaction_id AS id,
      t.type_name       AS type,
      c.category_name   AS category,
      tx.amount,
      tx.note,
      tx.txn_date       AS date
    FROM transactions tx
    JOIN transaction_type t ON t.type_id     = tx.type_id
    JOIN category c         ON c.category_id = tx.category_id
    ORDER BY tx.created_at DESC, tx.transaction_id DESC
    LIMIT 50
  `).all()
));

app.get('/api/insights', (req, res) => handle(res, () => {
  const today   = todaySummary();
  const week    = weekSummary();
  const cmp     = weekComparison();
  const top     = topCategories();
  const balance = runningBalance();
  return {
    today:   todayInsight(today),
    week:    weekInsights(week, cmp, top),
    balance: balanceInsight(balance),
  };
}));

app.delete('/api/transaction/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid transaction id' });
  }
  try {
    const tx = db.prepare(`
      SELECT tx.transaction_id AS id, t.type_name AS type,
             c.category_name AS category, tx.amount
      FROM transactions tx
      JOIN transaction_type t ON t.type_id     = tx.type_id
      JOIN category c         ON c.category_id = tx.category_id
      WHERE tx.transaction_id = ?
    `).get(id);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    db.prepare('DELETE FROM transactions WHERE transaction_id = ?').run(id);
    res.json({ deleted: tx });
  } catch (err) {
    console.error('[api]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`CashTrack API running at http://localhost:${PORT}`);
});
