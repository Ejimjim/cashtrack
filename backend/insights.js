'use strict';

function fmt(n) {
  return `N${Math.round(n).toLocaleString()}`;
}

function todayInsight(summary) {
  const { sales, expenses, net } = summary;
  if (sales === 0 && expenses === 0) return 'No transactions recorded today yet.';
  if (expenses === 0) return `All income today, no expenses recorded.`;
  if (sales === 0) return `Only expenses recorded today — no sales yet.`;
  if (net > 0) return `You are earning more than you are spending today.`;
  if (net < 0) return `You are spending more than you are earning today.`;
  return 'Your sales and expenses are exactly equal today.';
}

function weekInsights(summary, comparison, top) {
  const lines = [];
  const { sales, expenses, net } = summary;

  if (sales === 0 && expenses === 0) {
    lines.push('No transactions in the last 7 days.');
    return lines;
  }

  if (net > 0) {
    lines.push(`Good week — you earned ${fmt(net)} more than you spent.`);
  } else if (net < 0) {
    lines.push(`You are spending more than you are earning this week — down ${fmt(Math.abs(net))}.`);
  } else {
    lines.push('Your earnings and spending are exactly balanced this week.');
  }

  const hasPrevData = comparison.prevNet !== 0 || comparison.thisNet !== 0;
  if (hasPrevData) {
    const diff = comparison.difference;
    if (diff > 0) {
      lines.push(`This week is ${fmt(diff)} better than last week.`);
    } else if (diff < 0) {
      lines.push(`This week is ${fmt(Math.abs(diff))} worse than last week.`);
    } else {
      lines.push('This week is on par with last week.');
    }
  }

  if (top.expenses.length > 0) {
    const { category, total } = top.expenses[0];
    lines.push(`Your biggest expense this week is ${category} at ${fmt(total)}.`);
  }

  if (top.sales.length > 0) {
    const { category, total } = top.sales[0];
    lines.push(`Your top-selling item this week is ${category} at ${fmt(total)}.`);
  }

  return lines;
}

function balanceInsight(data) {
  const { sales, expenses, balance } = data;
  if (sales === 0 && expenses === 0) return 'No transactions recorded yet.';
  if (balance > 0) return `Overall you are ahead by ${fmt(balance)}.`;
  if (balance < 0) return `Overall you are behind by ${fmt(Math.abs(balance))}.`;
  return 'Your all-time sales and expenses are exactly equal.';
}

module.exports = { todayInsight, weekInsights, balanceInsight };
