const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Server returned ${res.status}`);
  return res.json();
}

export const getToday    = () => get('/api/today');
export const getWeek     = () => get('/api/week');
export const getBalance  = () => get('/api/balance');
export const getHistory  = () => get('/api/history');
export const getInsights = () => get('/api/insights');

export const deleteTransaction = id =>
  fetch(`${BASE}/api/transaction/${id}`, { method: 'DELETE' })
    .then(r => r.ok ? r.json() : Promise.reject(new Error(`Delete failed (${r.status})`)));
