'use strict';

const db = require('./db');

const categories = db.prepare(`
  SELECT
    t.type_name   AS type,
    c.category_name AS category,
    COUNT(tx.transaction_id) AS transactions
  FROM category c
  JOIN transaction_type t ON t.type_id = c.type_id
  LEFT JOIN transactions tx ON tx.category_id = c.category_id
  GROUP BY c.category_id
  ORDER BY t.type_name, transactions DESC, c.category_name
`).all();

const { total } = db.prepare(`SELECT COUNT(*) AS total FROM transactions`).get();

console.log('\nCategories\n');
console.table(categories);
console.log(`Total transactions: ${total}\n`);
