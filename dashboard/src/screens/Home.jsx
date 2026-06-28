import { useState, useEffect, useCallback } from 'react';
import { getBalance, getToday, getInsights } from '../api.js';

const fmt = n => `N${Math.round(n ?? 0).toLocaleString()}`;

function Loading() {
  return <div className="center-state"><p className="loading-text">Loading...</p></div>;
}

function ApiDown() {
  return (
    <div className="center-state">
      <div className="state-icon">📡</div>
      <p className="state-title">Server not running</p>
      <p className="state-hint">Start it with:<br /><strong>npm run api</strong><br />(in the backend folder)</p>
    </div>
  );
}

export default function Home() {
  const [balance,  setBalance]  = useState(null);
  const [today,    setToday]    = useState(null);
  const [insights, setInsights] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    Promise.all([getBalance(), getToday(), getInsights()])
      .then(([b, t, i]) => { setBalance(b); setToday(t); setInsights(i); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const isUp = balance && balance.balance >= 0;

  return (
    <div className="screen">
      <div className="header">
        <span className="header-title">CashTrack</span>
        <button className="refresh-btn" onClick={load} title="Refresh">↻</button>
      </div>

      {loading && <Loading />}
      {!loading && error && <ApiDown />}
      {!loading && !error && balance && today && insights && (
        <>
          {/* ── Running balance ── */}
          <div className={`card balance-card`}>
            <p className="balance-label">Money Available</p>
            <p className={`balance-amount ${isUp ? 'green' : 'red'}`}>
              {fmt(Math.abs(balance.balance))}
            </p>
            <span className={`status-pill ${isUp ? 'up' : 'down'}`}>
              {isUp ? '↑ You are ahead' : '↓ You are behind'}
            </span>
          </div>

          {/* ── Today's cards ── */}
          <p className="section-title">Today</p>
          <div className="two-col">
            <div className="mini-card">
              <p className="mini-label green">Money In</p>
              <p className="mini-amount green">{fmt(today.sales)}</p>
            </div>
            <div className="mini-card">
              <p className="mini-label red">Money Out</p>
              <p className="mini-amount red">{fmt(today.expenses)}</p>
            </div>
          </div>

          {/* ── Insight ── */}
          {insights.today && (
            <>
              <p className="section-title">Summary</p>
              <div className="insight-card">
                <p className="insight-line">{insights.today}</p>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
