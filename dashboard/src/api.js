const BASE = import.meta.env.VITE_API_URL ?? '';

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Server returned ${res.status}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
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

export const login     = (username, password) => post('/api/login', { username, password });
export const resetData = () => post('/api/reset', {});
