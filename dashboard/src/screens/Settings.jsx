export default function Settings() {
  return (
    <div className="screen">
      <div className="header">
        <span className="header-title">About</span>
      </div>

      <div className="settings-logo">
        <div className="icon">📊</div>
        <p className="name">CashTrack</p>
        <p className="desc">
          Track your daily sales and expenses by chatting with your Telegram bot.
          Open this dashboard to see where your money is going.
        </p>
      </div>

      <div className="card" style={{ margin: '0 16px 12px' }}>
        <div className="stat-row" style={{ paddingTop: 0 }}>
          <span className="stat-label">Record transactions</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>via Telegram bot</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">View figures</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>on this dashboard</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Version</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>1.0 · Layer 4</span>
        </div>
      </div>
    </div>
  );
}
