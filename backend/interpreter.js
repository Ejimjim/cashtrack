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

Segment the message into individual items. Items are separated by commas, line breaks, spaces between "item amount" pairs, or run together with no separator (e.g. "sold chicken 4000paid rent 20000"). Each item has the form: [optional verb] [item description] [amount].

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

"transactions" contains every item that has a clear amount AND either its own verb OR an inherited type from verb carry-forward (see Type rules).
"unclear" contains items that are missing an amount, OR items that appear before any verb has been seen in the message.

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

Type rules — VERB CARRY-FORWARD:
Process items strictly left to right, tracking the "current type" as you go.
  Sale verbs:    sold, received, got, collected.
  Expense verbs: paid, bought, spent, purchased.

  - Item HAS its own verb → set current type to what that verb means; this item uses that type.
  - Item has NO verb, current type EXISTS → inherit current type; this item goes to "transactions".
  - Item has NO verb, NO current type yet (nothing before it had a verb) → goes to "unclear".
  - Each new verb resets the current type for all items that follow it.

Examples of carry-forward:
  "sold fish 3000, gaz 4000, turkey 7000"
    → fish=sale (verb: sold), gaz=sale (inherited), turkey=sale (inherited)
  "sold fish 3000, gaz 4000, paid transport 500, rent 2000"
    → fish=sale (sold), gaz=sale (inherited), transport=expense (paid resets), rent=expense (inherited)
  "fish 3000, gaz 4000"
    → fish=unclear (no verb anywhere), gaz=unclear (no verb anywhere)
  "fish 3000, sold gaz 4000, turkey 7000"
    → fish=unclear (before any verb), gaz=sale (sold), turkey=sale (inherited)

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
