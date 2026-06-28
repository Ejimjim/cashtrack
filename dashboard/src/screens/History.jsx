import { useState, useEffect, useCallback } from 'react';
import { getHistory, deleteTransaction } from '../api.js';

const fmt = n => `N${Math.round(n ?? 0).toLocaleString()}`;

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function localYMD(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function groupLabel(dateStr) {
  const today     = localYMD();
  const yesterday = localYMD(new Date(Date.now() - 864e5));
  if (dateStr === today)     return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  const [year, month, day] = dateStr.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

function groupByDate(txns) {
  const map = new Map();
  for (const tx of txns) {
    if (!map.has(tx.date)) map.set(tx.date, []);
    map.get(tx.date).push(tx);
  }
  return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
}

export default function History() {
  const [txns,       setTxns]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(false);
  const [confirmId,  setConfirmId]  = useState(null);
  const [deleting,   setDeleting]   = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    setConfirmId(null);
    getHistory()
      .then(setTxns)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = useCallback(async () => {
    if (!confirmId || deleting) return;
    setDeleting(true);
    try {
      await deleteTransaction(confirmId);
      load();
    } catch {
      setDeleting(false);
      setConfirmId(null);
    }
  }, [confirmId, deleting, load]);

  return (
    <div className="screen">
      <div className="header">
        <span className="header-title">History</span>
        <button className="refresh-btn" onClick={load} title="Refresh">↻</button>
      </div>

      {loading && <div className="center-state"><p className="loading-text">Loading...</p></div>}

      {!loading && error && (
        <div className="center-state">
          <div className="state-icon">📡</div>
          <p className="state-title">Server not running</p>
          <p className="state-hint">Run: <strong>npm run api</strong></p>
        </div>
      )}

      {!loading && !error && txns && (
        txns.length === 0
          ? <p className="empty-state">No transactions yet.<br />Send a message to the bot to get started.</p>
          : groupByDate(txns).map(({ date, items }) => (
              <div key={date}>
                <p className="section-title">{groupLabel(date)}</p>
                <div className="txn-list">
                  {items.map(tx => {
                    const isConfirming = confirmId === tx.id;
                    return (
                      <div key={tx.id} className="txn-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0 }}>
                        {/* Main row */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div className="txn-left">
                            <p className="txn-category">{tx.category}</p>
                            {tx.note && <p className="txn-meta">{tx.note}</p>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <p className={`txn-amount ${tx.type === 'sale' ? 'green' : 'red'}`}>
                              {tx.type === 'sale' ? '+' : '−'}{fmt(tx.amount)}
                            </p>
                            {!isConfirming && (
                              <button
                                onClick={() => setConfirmId(tx.id)}
                                style={{
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  fontSize: '1.1rem', padding: '4px 6px', borderRadius: 6,
                                  color: '#d1d5db', lineHeight: 1,
                                }}
                                title="Delete"
                              >
                                🗑
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Inline confirmation */}
                        {isConfirming && (
                          <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            marginTop: 10, paddingTop: 10, borderTop: '1px solid #f3f4f6',
                          }}>
                            <span style={{ fontSize: '0.875rem', color: '#374151' }}>Remove this entry?</span>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                onClick={() => setConfirmId(null)}
                                disabled={deleting}
                                style={{
                                  padding: '6px 14px', borderRadius: 8, border: '1px solid #e5e7eb',
                                  background: '#f9fafb', color: '#374151', fontSize: '0.875rem',
                                  fontWeight: 600, cursor: 'pointer',
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleDelete}
                                disabled={deleting}
                                style={{
                                  padding: '6px 14px', borderRadius: 8, border: 'none',
                                  background: '#dc2626', color: '#fff', fontSize: '0.875rem',
                                  fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer',
                                  opacity: deleting ? 0.6 : 1,
                                }}
                              >
                                {deleting ? '…' : 'Yes, remove'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
      )}
    </div>
  );
}
