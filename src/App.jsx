import { useState } from 'react';
import { useTracker } from './store.js';
import LivePage from './pages/LivePage.jsx';
import TeamsPage from './pages/TeamsPage.jsx';
import ImportPage from './pages/ImportPage.jsx';
import { COLORS, fonts, monoLabel } from './theme.js';

const APP_TITLE = import.meta.env.VITE_APP_TITLE || 'tremblant 2026';

const TABS = [
  { id: 'live', label: 'Live' },
  { id: 'teams', label: 'Teams' },
  { id: 'input', label: 'Import' },
];

export default function App() {
  const tracker = useTracker();
  const [page, setPage] = useState('live');

  return (
    <div
      style={{
        maxWidth: 860,
        margin: '0 auto',
        padding: '20px 16px 60px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'rgba(240,238,233,0.92)',
          backdropFilter: 'blur(6px)',
          margin: '-20px -16px 0',
          padding: '12px 16px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          borderBottom: '1.5px solid rgba(0,0,0,0.08)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontFamily: fonts.hand, fontSize: 26, lineHeight: 1 }}>
              Tournament Photo Tracker
            </div>
            <SyncBadge tracker={tracker} />
          </div>
          <PhotographerPicker tracker={tracker} />
        </div>
        <PageNav active={page} onChange={setPage} />
      </header>

      {page === 'live' && <LivePage tracker={tracker} />}
      {page === 'teams' && <TeamsPage tracker={tracker} />}
      {page === 'input' && <ImportPage tracker={tracker} />}

      <footer style={{ ...monoLabel, display: 'flex', gap: 12, alignItems: 'center' }}>
        <span>{APP_TITLE}</span>
        {(!tracker.shared || tracker.session) && (
          <button
            onClick={() => {
              if (confirm('Reset all teams and live games to the seed data?')) tracker.reset();
            }}
            style={{
              border: 'none',
              background: 'transparent',
              ...monoLabel,
              cursor: 'pointer',
              marginLeft: 'auto',
            }}
          >
            ↺ reset data
          </button>
        )}
      </footer>
    </div>
  );
}

function PageNav({ active, onChange }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        padding: 4,
        borderRadius: 18,
        border: '1.5px solid #1c1a17',
        background: 'rgba(255,255,255,0.6)',
        width: 'fit-content',
        fontFamily: fonts.mono,
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}
    >
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            padding: '6px 16px',
            borderRadius: 14,
            border: 'none',
            cursor: 'pointer',
            fontFamily: fonts.mono,
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            background: active === t.id ? COLORS.ink : 'transparent',
            color: active === t.id ? COLORS.paper : COLORS.ink,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// Tells the team at a glance whether progress is shared live across phones, or
// only saved on this device (no backend configured).
function SyncBadge({ tracker }) {
  const shared = tracker.shared;
  const ok = shared ? tracker.online : true;
  const color = !shared ? 'rgba(0,0,0,0.4)' : ok ? COLORS.shot : COLORS.unshot;
  const label = !shared ? 'this device' : ok ? 'live · synced' : 'connecting…';
  return (
    <span
      title={
        shared
          ? 'Progress syncs live across everyone on the team.'
          : 'No backend configured — saved on this device only.'
      }
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        ...monoLabel,
        fontSize: 9,
        textTransform: 'uppercase',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: color,
          boxShadow: shared && ok ? `0 0 0 3px ${COLORS.shot}22` : 'none',
        }}
      />
      {label}
    </span>
  );
}

// Current photographer — stamped onto teams as they're marked.
function PhotographerPicker({ tracker }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, ...monoLabel }}>
      shooting as
      <input
        value={tracker.photographer}
        onChange={(e) => tracker.setPhotographer(e.target.value.toUpperCase().slice(0, 4))}
        style={{
          width: 56,
          padding: '4px 8px',
          border: '1.5px solid #1c1a17',
          borderRadius: 6,
          background: '#fff',
          fontFamily: fonts.mono,
          fontSize: 12,
          textAlign: 'center',
          color: COLORS.ink,
        }}
      />
    </label>
  );
}
