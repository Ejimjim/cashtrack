import { useState, useEffect, useCallback } from 'react';
import { getWeek, getInsights } from '../api.js';

const fmt = n => `N${Math.round(n ?? 0).toLocaleString()}`;

export default function Week() {
  const [data,     setData]     = useState(null);
  const [insights, setInsights] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    Promise.all([getWeek(), getInsights()])
      .then(([w, i]) => { setData(w); setInsights(i); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="screen">
      <div className="header"><span className="header-title">This Week</span></div>
      <div className="center-state"><p className="loading-text">Loading...</p></div>
    </div>
  );

  if (error) return (
    <div className="screen">
      <div className="header"><span className="header-title">This Week</span></div>
      <div className="center-state">
        <div className="state-icon">📡</div>
        <p className="state-title">Server not running</p>
        <p className="state-hint">Run: <strong>npm run api</strong></p>
      </div>
    </div>
  );

  const { summary, comparison, top } = data;
  const net  = summary.net;
  const diff = comparison.difference;

  return (
    <div className="screen">
      <div className="header">
        <span className="header-title">This Week</span>
        <button className="refresh-btn" onClick={load}>↻</button>
      </div>

      {/* Totals */}
      <div className="card" style={{ margin: '12px 16px' }}>
        <div className="stat-row">
          <span className="stat-label">Money In</span>
          <span className="stat-value green">{fmt(summary.sales)}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Money Out</span>
          <span className="stat-value red">{fmt(summary.expenses)}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Net</span>
          <span className={`stat-value ${net >= 0 ? 'green' : 'red'}`}>
            {net >= 0 ? '+' : ''}{fmt(net)}
          </span>
        </div>
      </div>

      {/* vs last week */}
      <div className="card" style={{ margin: '0 16px 0' }}>
        <div className="stat-row" style={{ paddingTop: 0, paddingBottom: 0, border: 'none' }}>
          <span className="stat-label">vs Last Week</span>
          <span className={`stat-value ${diff >= 0 ? 'green' : 'red'}`}>
            {diff >= 0 ? '↑ +' : '↓ '}{fmt(Math.abs(diff))}
          </span>
        </div>
      </div>

      {/* Top sellers */}
      {top.sales.length > 0 && (
        <>
          <p className="section-title">Top Sellers</p>
          <div className="card" style={{ margin: '0 16px' }}>
            {top.sales.map(r => (
              <div key={r.category} className="cat-row">
                <span className="cat-name">{r.category}</span>
                <span className="cat-amount green">{fmt(r.total)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Top costs */}
      {top.expenses.length > 0 && (
        <>
          <p className="section-title">Top Costs</p>
          <div className="card" style={{ margin: '0 16px' }}>
            {top.expenses.map(r => (
              <div key={r.category} className="cat-row">
                <span className="cat-name">{r.category}</span>
                <span className="cat-amount red">{fmt(r.total)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Insights */}
      {insights?.week?.length > 0 && (
        <>
          <p className="section-title">Summary</p>
          <div className="insight-card">
            {insights.week.map((line, i) => (
              <p key={i} className="insight-line">{line}</p>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
