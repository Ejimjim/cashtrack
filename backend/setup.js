const db = require('./db');

// ── Schema ────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS transaction_type (
    type_id   INTEGER PRIMARY KEY,
    type_name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS category (
    category_id   INTEGER PRIMARY KEY,
    type_id       INTEGER NOT NULL REFERENCES transaction_type(type_id),
    category_name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    transaction_id INTEGER PRIMARY KEY,
    type_id        INTEGER NOT NULL REFERENCES transaction_type(type_id),
    category_id    INTEGER NOT NULL REFERENCES category(category_id),
    amount         NUMERIC NOT NULL,
    note           TEXT,
    txn_date       DATE NOT NULL,
    source         TEXT,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);

// ── Seed transaction types ────────────────────────────────────────────────────

const insertType = db.prepare(
  `INSERT OR IGNORE INTO transaction_type (type_name) VALUES (?)`
);

insertType.run('sale');
insertType.run('expense');

const saleId    = db.prepare(`SELECT type_id FROM transaction_type WHERE type_name = 'sale'`).get().type_id;
const expenseId = db.prepare(`SELECT type_id FROM transaction_type WHERE type_name = 'expense'`).get().type_id;

// ── Verification ──────────────────────────────────────────────────────────────

const tables = ['transaction_type', 'category', 'transactions'];

console.log('\nCashTrack database ready.\n');
console.log('Table'.padEnd(20), 'Row count');
console.log('-'.repeat(30));

for (const table of tables) {
  const { count } = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get();
  console.log(table.padEnd(20), count);
}

console.log('\nDone.\n');
