'use strict';

const { OpenAI } = require('openai');
const db = require('./db');

function getCategoriesForType(typeName) {
  const row = db.prepare('SELECT type_id FROM transaction_type WHERE type_name = ?').get(typeName);
  if (!row) return [];
  return db.prepare('SELECT category_name FROM category WHERE type_id = ?')
    .all(row.type_id)
    .map(r => r.category_name);
}

async function interpret(text) {
  const saleCategories    = getCategoriesForType('sale');
  const expenseCategories = getCategoriesForType('expense');

  const existingSale    = saleCategories.length    ? saleCategories.join(', ')    : '(none yet)';
  const existingExpense = expenseCategories.length ? expenseCategories.join(', ') : '(none yet)';

  const systemPrompt = `You are a transaction data extractor for a small-business cash-flow app.

The user sends a message that may contain one or more transactions written in any format:
separate lines, commas, spaces, or run together with no separator at all
(e.g. "sold chicken 4000sold fish 2500paid rent 20000").

Segment the message into individual transactions using ACTION VERBS as boundaries.
Sale verbs: sold, received, got, collected.
Expense verbs: paid, bought, spent, purchased.
Each verb marks the start of a new transaction. Do not use punctuation or line breaks as the primary boundary — use verbs.

Return ONLY a valid JSON object with exactly two keys:

{
  "transactions": [
    {
      "type": "sale" or "expense",
      "amount": <positive number, no currency symbol>,
      "category": <specific item — see category rules>,
      "note": <extra detail only — null if none>
    }
  ],
  "unclear": ["<raw fragment>", ...]
}

"transactions" contains every segment that has BOTH a clear verb AND a clear amount.
"unclear" contains every segment that is missing a verb OR missing an amount. Never guess a missing verb from a neighbouring item.

Category rules:
- The category must be the SPECIFIC item or purpose from the message — never a broad group.
  CORRECT: "sold chicken 4000" → category "chicken"
  WRONG:   "sold chicken 4000" → category "food" or "poultry"
  CORRECT: "paid driver 500"   → category "transport"
  WRONG:   "paid driver 500"   → category "services"
- Short lowercase noun or noun phrase, 2–3 words max. No capitals, no punctuation.
- Check existing categories before creating a new one:
    Existing sale categories: ${existingSale}
    Existing expense categories: ${existingExpense}
- Reuse an existing category ONLY if it names the same specific item. "chicken" matches "chicken"; it does NOT match "Food & Drinks" or "food".
- When creating a new category, use correct standard English spelling regardless of how the user spelled it (e.g. "chiken" → "chicken").

Note rules:
- "note" captures EXTRA detail beyond item and amount (variety, recipient, occasion). Return null if there is nothing extra.
  CORRECT: "sold frozen chicken 4000" → note "frozen"
  CORRECT: "paid rent for shop 15000" → note "shop"
  CORRECT: "sold chicken 4000"        → note null

Type rules:
- "type" must be exactly "sale" or "expense" — derived strictly from the verb in that segment.
- A segment with no verb must go to "unclear", never to "transactions".

If the entire message is uninterpretable, return {"transactions": [], "unclear": ["<original message>"]}.`;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: text },
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
  });

  const parsed = JSON.parse(response.choices[0].message.content);

  return {
    transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
    unclear:      Array.isArray(parsed.unclear)      ? parsed.unclear      : [],
  };
}

module.exports = { interpret };
