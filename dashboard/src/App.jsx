import { useState } from 'react';
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
  const [tab, setTab] = useState('home');
  const Screen = SCREENS[tab];

  return (
    <div className="app">
      <Screen />
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
