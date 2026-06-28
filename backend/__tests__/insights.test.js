'use strict';

// insights.js is a pure function module — no database, no mocks needed.
const { todayInsight, weekInsights, balanceInsight } = require('../insights');

const EMPTY_TOP = { sales: [], expenses: [] };
const EMPTY_CMP = { thisNet: 0, prevNet: 0, difference: 0 };

// ─────────────────────────────────────────────────────────────────────────────
// todayInsight
// ─────────────────────────────────────────────────────────────────────────────

describe('todayInsight', () => {
  test('no transactions at all', () => {
    expect(todayInsight({ sales: 0, expenses: 0, net: 0 }))
      .toBe('No transactions recorded today yet.');
  });

  test('sales only — no expenses recorded yet', () => {
    expect(todayInsight({ sales: 5000, expenses: 0, net: 5000 }))
      .toBe('All income today, no expenses recorded.');
  });

  test('expenses only — no sales recorded yet', () => {
    expect(todayInsight({ sales: 0, expenses: 5000, net: -5000 }))
      .toBe('Only expenses recorded today — no sales yet.');
  });

  test('positive net — earning more than spending', () => {
    expect(todayInsight({ sales: 8000, expenses: 3000, net: 5000 }))
      .toBe('You are earning more than you are spending today.');
  });

  test('negative net — spending more than earning', () => {
    expect(todayInsight({ sales: 3000, expenses: 8000, net: -5000 }))
      .toBe('You are spending more than you are earning today.');
  });

  test('net exactly zero', () => {
    expect(todayInsight({ sales: 5000, expenses: 5000, net: 0 }))
      .toBe('Your sales and expenses are exactly equal today.');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// weekInsights
// ─────────────────────────────────────────────────────────────────────────────

describe('weekInsights', () => {
  test('no transactions returns a single-element array', () => {
    const r = weekInsights({ sales: 0, expenses: 0, net: 0 }, EMPTY_CMP, EMPTY_TOP);
    expect(r).toHaveLength(1);
    expect(r[0]).toBe('No transactions in the last 7 days.');
  });

  test('positive week net opens with an encouraging line', () => {
    const r = weekInsights({ sales: 10000, expenses: 4000, net: 6000 }, EMPTY_CMP, EMPTY_TOP);
    expect(r[0]).toBe('Good week — you earned N6,000 more than you spent.');
  });

  test('negative week net opens with an overspending warning', () => {
    const r = weekInsights({ sales: 3000, expenses: 8000, net: -5000 }, EMPTY_CMP, EMPTY_TOP);
    expect(r[0]).toBe('You are spending more than you are earning this week — down N5,000.');
  });

  test('zero net says earnings and spending are balanced', () => {
    const r = weekInsights({ sales: 5000, expenses: 5000, net: 0 }, EMPTY_CMP, EMPTY_TOP);
    expect(r[0]).toBe('Your earnings and spending are exactly balanced this week.');
  });

  test('positive comparison adds "better than last week" line', () => {
    const cmp = { thisNet: 8000, prevNet: 3000, difference: 5000 };
    const r = weekInsights({ sales: 10000, expenses: 2000, net: 8000 }, cmp, EMPTY_TOP);
    expect(r).toContain('This week is N5,000 better than last week.');
  });

  test('negative comparison adds "worse than last week" line', () => {
    const cmp = { thisNet: 1000, prevNet: 6000, difference: -5000 };
    const r = weekInsights({ sales: 5000, expenses: 4000, net: 1000 }, cmp, EMPTY_TOP);
    expect(r).toContain('This week is N5,000 worse than last week.');
  });

  test('equal comparison (both non-zero) adds "on par" line', () => {
    const cmp = { thisNet: 4000, prevNet: 4000, difference: 0 };
    const r = weekInsights({ sales: 6000, expenses: 2000, net: 4000 }, cmp, EMPTY_TOP);
    expect(r).toContain('This week is on par with last week.');
  });

  test('no comparison line when both this week and last week are zero', () => {
    // hasPrevData is false only when both thisNet and prevNet are 0
    const cmp = { thisNet: 0, prevNet: 0, difference: 0 };
    const r = weekInsights({ sales: 5000, expenses: 3000, net: 2000 }, cmp, EMPTY_TOP);
    expect(r.join(' ')).not.toMatch(/last week/i);
  });

  test('includes top expense category line when expenses exist', () => {
    const top = { sales: [], expenses: [{ category: 'rent', total: 20000 }] };
    const r = weekInsights({ sales: 5000, expenses: 20000, net: -15000 }, EMPTY_CMP, top);
    expect(r).toContain('Your biggest expense this week is rent at N20,000.');
  });

  test('includes top sale category line when sales exist', () => {
    const top = { sales: [{ category: 'chicken', total: 9000 }], expenses: [] };
    const r = weekInsights({ sales: 9000, expenses: 0, net: 9000 }, EMPTY_CMP, top);
    expect(r).toContain('Your top-selling item this week is chicken at N9,000.');
  });

  test('both top category lines appear when both types are present', () => {
    const top = {
      sales:    [{ category: 'fish', total: 5000 }],
      expenses: [{ category: 'rent', total: 8000 }],
    };
    const r = weekInsights({ sales: 5000, expenses: 8000, net: -3000 }, EMPTY_CMP, top);
    expect(r).toContain('Your biggest expense this week is rent at N8,000.');
    expect(r).toContain('Your top-selling item this week is fish at N5,000.');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// balanceInsight
// ─────────────────────────────────────────────────────────────────────────────

describe('balanceInsight', () => {
  test('no transactions at all', () => {
    expect(balanceInsight({ sales: 0, expenses: 0, balance: 0 }))
      .toBe('No transactions recorded yet.');
  });

  test('positive balance', () => {
    expect(balanceInsight({ sales: 20000, expenses: 8000, balance: 12000 }))
      .toBe('Overall you are ahead by N12,000.');
  });

  test('negative balance', () => {
    expect(balanceInsight({ sales: 5000, expenses: 12000, balance: -7000 }))
      .toBe('Overall you are behind by N7,000.');
  });

  test('zero balance with real transactions (sales equal expenses)', () => {
    expect(balanceInsight({ sales: 5000, expenses: 5000, balance: 0 }))
      .toBe('Your all-time sales and expenses are exactly equal.');
  });
});
