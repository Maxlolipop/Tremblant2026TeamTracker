import { useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader, SketchBox, Dot, Chip, ShotTimes, isShot, paperStyle } from '../kit.jsx';
import { COLORS, fonts, monoLabel } from '../theme.js';

// Live games. When a real NBHPA schedule has been loaded we drive everything
// off it (ScheduleLive); otherwise we fall back to the seed rink view.
export default function LivePage({ tracker }) {
  if (tracker.games?.length) return <ScheduleLive tracker={tracker} />;
  return <SeedLive tracker={tracker} />;
}

// ─── Undo footer shared by both modes ──────────────────────────────────────
function UndoRow({ tracker, children }) {
  return (
    <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <Chip status="unshot">not yet</Chip>
      <Chip status="shot">photographed</Chip>
      {children}
      <button
        onClick={tracker.undo}
        disabled={!tracker.canUndo}
        style={{
          marginLeft: 'auto',
          border: 'none',
          background: 'transparent',
          ...monoLabel,
          cursor: tracker.canUndo ? 'pointer' : 'default',
          opacity: tracker.canUndo ? 1 : 0.4,
        }}
      >
        ↶ undo last
      </button>
    </div>
  );
}

// ─── Schedule-driven live view ─────────────────────────────────────────────
function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}
function toMin(hm) {
  const [h, m] = (hm || '').split(':').map(Number);
  return Number.isFinite(h) ? h * 60 + m : null;
}
const REFRESH_MS = 60_000;
const LIVE_WINDOW = 75; // a game is "live" from its start until +75 min

function ScheduleLive({ tracker }) {
  const { games, byId, schedule, photographGame, loadSchedule } = tracker;
  const [query, setQuery] = useState('');
  const [liveOnly, setLiveOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState(null);
  const [, tick] = useState(0); // re-render so "live now" tracks the clock

  const days = useMemo(() => [...new Set(games.map((g) => g.date))].sort(), [games]);
  const today = new Date().toISOString().slice(0, 10);
  const [day, setDay] = useState(() => (days.includes(today) ? today : days[0]));
  useEffect(() => {
    if (!days.includes(day)) setDay(days.includes(today) ? today : days[0]);
  }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the live-now highlight current, and quietly re-pull the schedule so
  // roster/matchup changes appear without a manual refresh.
  const refresh = useRef(() => {});
  refresh.current = async () => {
    if (!schedule?.url) return;
    setRefreshing(true);
    setErr(null);
    try {
      await loadSchedule(schedule.url);
    } catch (e) {
      setErr(e.message);
    } finally {
      setRefreshing(false);
    }
  };
  useEffect(() => {
    const id = setInterval(() => {
      tick((n) => n + 1);
      refresh.current();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const q = query.trim().toLowerCase();
  const isLive = (g) => {
    if (g.date !== today) return false;
    const start = toMin(g.time);
    if (start == null) return false;
    const now = nowMinutes();
    return now >= start && now < start + LIVE_WINDOW;
  };

  const rows = useMemo(() => {
    return games
      .filter((g) => g.date === day)
      .filter((g) => !liveOnly || isLive(g))
      .filter((g) => {
        if (!q) return true;
        return (
          g.t1.name.toLowerCase().includes(q) ||
          g.t2.name.toLowerCase().includes(q) ||
          g.division.toLowerCase().includes(q) ||
          g.venue.toLowerCase().includes(q)
        );
      })
      .sort(
        (a, b) =>
          (a.time || '').localeCompare(b.time || '') ||
          a.venue.localeCompare(b.venue, undefined, { numeric: true }),
      );
  }, [games, day, liveOnly, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetched = schedule?.fetchedAt
    ? new Date(schedule.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div style={paperStyle}>
      <PageHeader
        title="Live now"
        subtitle="live schedule"
        right={
          <div style={{ ...monoLabel, textAlign: 'right' }}>
            <div>{games.length} games · {days.length} days</div>
            <div style={{ marginTop: 2 }}>
              {refreshing ? 'refreshing…' : `synced ${fetched}`}
            </div>
          </div>
        }
      />

      {/* Day tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {days.map((d) => (
          <Chip key={d} active={d === day} onClick={() => setDay(d)}>
            {new Date(d + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </Chip>
        ))}
        <div style={{ flex: 1 }} />
        <Chip active={liveOnly} onClick={() => setLiveOnly((v) => !v)}>
          ● live only
        </Chip>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="filter by team, division or rink…"
        style={{
          border: '1.5px solid #1c1a17',
          borderRadius: 8,
          padding: '6px 10px',
          background: '#fff',
          fontFamily: fonts.mono,
          fontSize: 12,
          color: COLORS.ink,
        }}
      />

      {err && <div style={{ ...monoLabel, color: COLORS.unshot, textTransform: 'none' }}>⚠ {err}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.length === 0 && (
          <div style={{ ...monoLabel, textTransform: 'none', padding: 8 }}>
            {liveOnly ? 'No games live right now.' : 'No games for this day.'}
          </div>
        )}
        {rows.map((g) => {
          const a = byId(g.t1.id);
          const b = byId(g.t2.id);
          const bothShot = isShot(a) && isShot(b);
          const live = isLive(g);
          return (
            <div
              key={g.id}
              role="button"
              tabIndex={0}
              onClick={() => photographGame(g.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  photographGame(g.id);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'stretch',
                gap: 8,
                padding: 6,
                border: `2px solid ${live ? COLORS.unshot : '#1c1a17'}`,
                borderRadius: 10,
                background: bothShot ? 'rgba(31,138,62,0.08)' : '#fff',
                cursor: 'pointer',
                boxShadow: '2px 2px 0 rgba(0,0,0,0.08)',
              }}
            >
              <div
                style={{
                  width: 78,
                  flex: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: bothShot ? COLORS.shot : COLORS.ink,
                  color: COLORS.paper,
                  borderRadius: 6,
                  padding: 6,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontFamily: fonts.hand, fontSize: 26, lineHeight: 1 }}>{g.time}</div>
                <div style={{ ...monoLabel, fontSize: 8, color: 'rgba(255,255,255,0.75)', marginTop: 3 }}>
                  {g.venue}
                </div>
                {live && (
                  <div style={{ ...monoLabel, fontSize: 8, color: '#ffd2c9', marginTop: 3 }}>● live</div>
                )}
              </div>
              <GameTeam team={a} division={g.division} />
              <div style={{ fontFamily: fonts.hand, fontSize: 20, alignSelf: 'center', color: 'rgba(0,0,0,0.5)' }}>
                @
              </div>
              <GameTeam team={b} division={g.division} />
            </div>
          );
        })}
      </div>

      <UndoRow tracker={tracker}>
        <button
          onClick={() => refresh.current()}
          disabled={refreshing}
          style={{
            border: 'none',
            background: 'transparent',
            ...monoLabel,
            cursor: refreshing ? 'default' : 'pointer',
            opacity: refreshing ? 0.5 : 1,
          }}
        >
          ↻ refresh
        </button>
      </UndoRow>
    </div>
  );
}

function GameTeam({ team, division }) {
  if (!team) return <div style={{ flex: 1 }} />;
  const shot = isShot(team);
  return (
    <SketchBox status={shot ? 'shot' : 'unshot'} style={{ flex: 1, background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
        <span style={monoLabel}>{division}</span>
        <Dot shot={shot} />
      </div>
      <div style={{ fontFamily: fonts.hand, fontSize: 22, lineHeight: 1.05, marginTop: 4 }}>
        {team.name}
      </div>
      <ShotTimes shots={team.shots} />
    </SketchBox>
  );
}

// ─── Seed rink view (no schedule loaded) ───────────────────────────────────
function SeedLive({ tracker }) {
  const { liveGames, byId, toggleRink } = tracker;

  return (
    <div style={paperStyle}>
      <PageHeader
        title="Live now"
        subtitle="tap rink → mark both"
        right={
          <div style={{ ...monoLabel, textAlign: 'right' }}>
            <div>{liveGames.length} rinks</div>
            <div style={{ marginTop: 2 }}>load a schedule on the Import tab</div>
          </div>
        }
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {liveGames.map((g) => {
          const home = byId(g.home);
          const away = byId(g.away);
          if (!home || !away) return null;
          const bothShot = isShot(home) && isShot(away);
          return (
            <div
              key={g.rink}
              role="button"
              tabIndex={0}
              onClick={() => toggleRink(g.rink)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleRink(g.rink);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'stretch',
                gap: 10,
                padding: 6,
                border: '2px solid #1c1a17',
                borderRadius: 10,
                background: bothShot ? 'rgba(31,138,62,0.08)' : '#fff',
                cursor: 'pointer',
                boxShadow: '2px 2px 0 rgba(0,0,0,0.08)',
              }}
            >
              <div
                style={{
                  width: 96,
                  flex: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: bothShot ? COLORS.shot : COLORS.ink,
                  color: COLORS.paper,
                  borderRadius: 6,
                  padding: 8,
                }}
              >
                <div style={{ ...monoLabel, fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>rink</div>
                <div style={{ fontFamily: fonts.hand, fontSize: 44, lineHeight: 1, marginTop: -2 }}>
                  {g.rink}
                </div>
                <div style={{ fontFamily: fonts.hand, fontSize: 14, lineHeight: 1, marginTop: 4 }}>
                  {bothShot ? '✓ shot · tap again' : 'tap to mark'}
                </div>
              </div>

              <SeedTeamCell role="home" team={home} />
              <div style={{ fontFamily: fonts.hand, fontSize: 22, alignSelf: 'center', color: 'rgba(0,0,0,0.5)' }}>
                vs
              </div>
              <SeedTeamCell role="away" team={away} />
            </div>
          );
        })}
      </div>

      <UndoRow tracker={tracker} />
    </div>
  );
}

function SeedTeamCell({ role, team }) {
  const shot = isShot(team);
  return (
    <SketchBox status={shot ? 'shot' : 'unshot'} style={{ flex: 1, background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={monoLabel}>
          {role} · {team.division}
        </span>
        <Dot shot={shot} />
      </div>
      <div style={{ fontFamily: fonts.hand, fontSize: 28, lineHeight: 1, marginTop: 4 }}>
        {team.name}
      </div>
      <ShotTimes shots={team.shots} />
    </SketchBox>
  );
}
