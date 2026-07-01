import { useState } from 'react';
import Login    from './screens/Login.jsx';
import Home     from './screens/Home.jsx';
import History  from './screens/History.jsx';
import Week     from './screens/Week.jsx';
import Settings from './screens/Settings.jsx';

const TABS = [
  { id: 'home',     label: 'Home',    icon: '🏠' },
  { id: 'history',  label: 'History', icon: '📋' },
  { id: 'week',     label: 'Week',    icon: '📊' },
  { id: 'settings', label: 'More',    icon: '⚙️' },
];

const SCREENS = { home: Home, history: History, week: Week, settings: Settings };

export default function App() {
  const [role, setRole] = useState(() => localStorage.getItem('ct_role'));
  const [tab,  setTab]  = useState('home');

  function handleLogin(r) {
    localStorage.setItem('ct_role', r);
    setRole(r);
  }

  function handleLogout() {
    localStorage.removeItem('ct_role');
    setRole(null);
    setTab('home');
  }

  if (!role) return <Login onLogin={handleLogin} />;

  const Screen = SCREENS[tab];

  return (
    <div className="app">
      <Screen role={role} onLogout={handleLogout} />
      <nav className="bottom-nav">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`nav-btn${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="nav-icon">{t.icon}</span>
            <span className="nav-label">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
