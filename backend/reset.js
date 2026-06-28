'use strict';

const db = require('./db');

db.exec(`
  DELETE FROM transactions;
  DELETE FROM category;
`);

const { txns }  = db.prepare('SELECT COUNT(*) AS txns FROM transactions').get();
const { cats }  = db.prepare('SELECT COUNT(*) AS cats FROM category').get();
const { types } = db.prepare('SELECT COUNT(*) AS types FROM transaction_type').get();

console.log('\nDatabase reset.\n');
console.log(`  transaction_type : ${types} rows (untouched)`);
console.log(`  category         : ${cats} rows`);
console.log(`  transactions     : ${txns} rows`);
console.log('\nReady for fresh testing.\n');
