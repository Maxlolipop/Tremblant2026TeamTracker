import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SEED_TEAMS, SEED_LIVE_GAMES } from './data.js';
import { fetchSchedule, gamesToTeams } from './schedule.js';
import { supabase, isShared } from './supabase.js';

const KEY = 'tremblant-tracker-v1';        // local-mode full state
const PHOTOG_KEY = 'tremblant-photographer'; // always per-device
const META_ID = 'current';

function nowHM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Who's shooting is a *per-device* identity, never shared — each phone keeps
// its own initials in localStorage.
function loadPhotographer() {
  try {
    return localStorage.getItem(PHOTOG_KEY) || 'AM';
  } catch {
    return 'AM';
  }
}

// ── shared shapes ────────────────────────────────────────────────────────────
// The roster (teams/schedule) and the shots are stored separately on the
// server. `roster.teams` carry no shots; we merge the shots table back in here
// so the rest of the app keeps seeing the original `{ ...team, shots: [] }`.
function stripShots(teams) {
  return teams.map(({ shots, ...t }) => t);
}
function mergeTeams(rosterTeams, shotRows) {
  const byTeam = {};
  for (const r of shotRows) (byTeam[r.team_id] ||= []).push({ id: r.id, time: r.at, by: r.by });
  return rosterTeams.map((t) => ({ ...t, shots: byTeam[t.id] || [] }));
}

// ── seed / local helpers ─────────────────────────────────────────────────────
function normalizeTeam(t) {
  if (Array.isArray(t.shots)) return { ...t, shots: t.shots };
  const shots = t.shot && t.time ? [{ time: t.time, by: t.by || '?' }] : [];
  const { shot, time, by, ...rest } = t;
  return { ...rest, shots };
}
function seedState() {
  return {
    teams: SEED_TEAMS.map(normalizeTeam),
    liveGames: SEED_LIVE_GAMES,
    games: [],
    schedule: null,
  };
}
function loadLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return {
        teams: (s.teams || []).map(normalizeTeam),
        liveGames: s.liveGames || SEED_LIVE_GAMES,
        games: s.games || [],
        schedule: s.schedule || null,
      };
    }
  } catch {
    // ignore corrupt state and fall back to seed
  }
  return seedState();
}

// Build the {teams, liveGames, games, schedule} blob the server stores from an
// in-memory state (shots stripped — they live in their own table).
function rosterFromState(s) {
  return { teams: stripShots(s.teams), liveGames: s.liveGames, games: s.games, schedule: s.schedule };
}

// ──────────────────────────────────────────────────────────────────────────────
// Single source of truth for the whole app. In SHARED mode it syncs through
// Supabase (every phone sees the same progress live); otherwise it persists to
// localStorage exactly like before. The returned API is identical either way.
export function useTracker() {
  const [state, setState] = useState(isShared ? seedState : loadLocal);
  const [online, setOnline] = useState(!isShared); // local mode is always "ready"
  const [photographer, setPhotographerState] = useState(loadPhotographer);
  const undoStack = useRef([]);
  const [canUndo, setCanUndo] = useState(false);
  // `by` must be readable inside async server callbacks without going stale.
  const byRef = useRef(photographer);
  byRef.current = photographer;

  // ── local-mode persistence ───────────────────────────────────────────────
  useEffect(() => {
    if (isShared) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // storage full / disabled — non-fatal
    }
  }, [state]);

  const pushUndo = useCallback((entry) => {
    undoStack.current.push(entry);
    if (undoStack.current.length > 25) undoStack.current.shift();
    setCanUndo(true);
  }, []);

  // ── shared-mode wiring ─────────────────────────────────────────────────────
  // Re-pull roster + shots and rebuild state. Debounced so a burst of realtime
  // events (e.g. a rink marking two teams) coalesces into one refresh.
  const refetchTimer = useRef(null);
  const refetch = useCallback(async () => {
    const [{ data: meta }, { data: shots }] = await Promise.all([
      supabase.from('meta').select('data').eq('id', META_ID).maybeSingle(),
      supabase.from('shots').select('id,team_id,at,by').order('created_at', { ascending: true }),
    ]);
    const roster = meta?.data?.teams ? meta.data : null;
    setState(
      roster
        ? {
            teams: mergeTeams(roster.teams, shots || []),
            liveGames: roster.liveGames || [],
            games: roster.games || [],
            schedule: roster.schedule || null,
          }
        : seedState(),
    );
    setOnline(true);
  }, []);
  const scheduleRefetch = useCallback(() => {
    clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(refetch, 150);
  }, [refetch]);

  useEffect(() => {
    if (!isShared) return;
    let cancelled = false;
    (async () => {
      // First run on an empty project: plant the seed roster so there's
      // something to look at before a schedule/file is imported.
      const { data: meta } = await supabase.from('meta').select('id').eq('id', META_ID).maybeSingle();
      if (cancelled) return;
      if (!meta) {
        await supabase.from('meta').insert({ id: META_ID, data: rosterFromState(seedState()) });
      }
      if (!cancelled) await refetch();
    })().catch(() => setOnline(false));

    const channel = supabase
      .channel('tracker')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shots' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meta' }, scheduleRefetch)
      .subscribe();

    return () => {
      cancelled = true;
      clearTimeout(refetchTimer.current);
      supabase.removeChannel(channel);
    };
  }, [refetch, scheduleRefetch]);

  // Write the roster blob, but only if it actually changed — otherwise the
  // LivePage's 60s schedule auto-refresh would write identical data on every
  // open client and trigger an endless realtime echo across phones.
  const writeRoster = useCallback(async (nextState) => {
    const data = rosterFromState(nextState);
    const { data: cur } = await supabase.from('meta').select('data').eq('id', META_ID).maybeSingle();
    if (cur && JSON.stringify(cur.data) === JSON.stringify(data)) return;
    await supabase.from('meta').upsert({ id: META_ID, data, updated_at: new Date().toISOString() });
  }, []);

  // ── core mutations ─────────────────────────────────────────────────────────
  // Log a fresh photo session for each given team. The central "mark" action.
  const photographTeams = useCallback(
    (ids) => {
      const by = byRef.current;
      const at = nowHM();
      if (isShared) {
        // Optimistic: show it immediately, persist append-only in the
        // background. Inserts never clobber a teammate's concurrent mark.
        setState((s) => {
          const set = new Set(ids);
          return {
            ...s,
            teams: s.teams.map((t) =>
              set.has(t.id) ? { ...t, shots: [...t.shots, { time: at, by, pending: true }] } : t,
            ),
          };
        });
        supabase
          .from('shots')
          .insert(ids.map((team_id) => ({ team_id, at, by })))
          .select('id')
          .then(({ data }) => {
            if (data?.length) pushUndo({ type: 'insert', ids: data.map((r) => r.id) });
            scheduleRefetch();
          });
        return;
      }
      setState((s) => {
        const set = new Set(ids);
        if (![...set].some((id) => s.teams.find((t) => t.id === id))) return s;
        pushUndo({ type: 'local', teams: s.teams });
        return {
          ...s,
          teams: s.teams.map((t) =>
            set.has(t.id) ? { ...t, shots: [...t.shots, { time: at, by }] } : t,
          ),
        };
      });
    },
    [pushUndo, scheduleRefetch],
  );

  // Teams-page correction: clear all of a team's shots if any, else add one.
  const toggleTeam = useCallback(
    (id) => {
      const by = byRef.current;
      const at = nowHM();
      if (isShared) {
        const team = state.teams.find((t) => t.id === id);
        if (!team) return;
        if (team.shots.length) {
          const removed = team.shots; // for undo re-insert
          setState((s) => ({ ...s, teams: s.teams.map((t) => (t.id === id ? { ...t, shots: [] } : t)) }));
          supabase
            .from('shots')
            .delete()
            .eq('team_id', id)
            .then(() => {
              pushUndo({ type: 'delete', rows: removed.map((r) => ({ team_id: id, at: r.time, by: r.by })) });
              scheduleRefetch();
            });
        } else {
          photographTeams([id]);
        }
        return;
      }
      setState((s) => {
        const t = s.teams.find((x) => x.id === id);
        if (!t) return s;
        pushUndo({ type: 'local', teams: s.teams });
        const shots = t.shots.length ? [] : [{ time: at, by }];
        return { ...s, teams: s.teams.map((x) => (x.id === id ? { ...x, shots } : x)) };
      });
    },
    [state.teams, pushUndo, photographTeams, scheduleRefetch],
  );

  // Seed/demo rink (rink → both teams).
  const toggleRink = useCallback(
    (rink) => {
      const game = state.liveGames.find((g) => g.rink === rink);
      if (game) photographTeams([game.home, game.away]);
    },
    [state.liveGames, photographTeams],
  );

  // Schedule-driven matchup: tap a scheduled game to log both its teams.
  const photographGame = useCallback(
    (gameId) => {
      const g = state.games.find((x) => x.id === gameId);
      if (g) photographTeams([g.t1.id, g.t2.id]);
    },
    [state.games, photographTeams],
  );

  const undo = useCallback(() => {
    const entry = undoStack.current.pop();
    setCanUndo(undoStack.current.length > 0);
    if (!entry) return;
    if (entry.type === 'local') {
      setState((s) => ({ ...s, teams: entry.teams }));
    } else if (entry.type === 'insert') {
      supabase.from('shots').delete().in('id', entry.ids).then(scheduleRefetch);
    } else if (entry.type === 'delete') {
      supabase.from('shots').insert(entry.rows).then(scheduleRefetch);
    }
  }, [scheduleRefetch]);

  const setPhotographer = useCallback((by) => {
    setPhotographerState(by);
    try {
      localStorage.setItem(PHOTOG_KEY, by);
    } catch {
      // ignore
    }
  }, []);

  // Replace the roster from a spreadsheet import. Brand-new teams start empty,
  // so a fresh import also wipes any shots from the previous tournament.
  const importTeams = useCallback(
    (rows) => {
      const teams = rows.map((r, i) => ({
        id: `i${Date.now()}-${i}`,
        name: r.name,
        division: r.division || '—',
        shots: [],
      }));
      const byRink = {};
      rows.forEach((r, i) => {
        if (!r.rink) return;
        (byRink[r.rink] ||= []).push(teams[i].id);
      });
      const liveGames = Object.entries(byRink)
        .filter(([, ids]) => ids.length >= 2)
        .map(([rink, ids]) => ({ rink, home: ids[0], away: ids[1] }));
      const next = {
        teams,
        games: [],
        schedule: null,
        liveGames: liveGames.length ? liveGames : SEED_LIVE_GAMES,
      };
      if (isShared) {
        setState(next);
        (async () => {
          await supabase.from('shots').delete().gt('created_at', '1900-01-01');
          await writeRoster(next);
          scheduleRefetch();
        })();
        return;
      }
      setState((s) => {
        pushUndo({ type: 'local', teams: s.teams });
        return next;
      });
    },
    [pushUndo, writeRoster, scheduleRefetch],
  );

  // Pull the live NBHPA schedule. Shots are keyed by the site's stable team id,
  // so re-pulling the roster never disturbs progress already recorded.
  const loadSchedule = useCallback(
    async (url) => {
      const result = await fetchSchedule(url);
      const next = {
        teams: gamesToTeams(result.games),
        games: result.games,
        schedule: {
          url: result.url,
          seasonId: result.seasonId,
          leagueId: result.leagueId,
          fetchedAt: result.fetchedAt,
        },
        liveGames: state.liveGames,
      };
      if (isShared) {
        await writeRoster(next); // no-op if nothing changed (tames auto-refresh)
        scheduleRefetch();
        return result.games.length;
      }
      setState((s) => {
        const prevShots = new Map(s.teams.map((t) => [t.id, t.shots]));
        return { ...next, teams: next.teams.map((t) => ({ ...t, shots: prevShots.get(t.id) || [] })) };
      });
      return result.games.length;
    },
    [state.liveGames, writeRoster, scheduleRefetch],
  );

  const reset = useCallback(() => {
    const seed = seedState();
    if (isShared) {
      setState(seed);
      (async () => {
        await supabase.from('shots').delete().gt('created_at', '1900-01-01');
        const rows = seed.teams.flatMap((t) =>
          t.shots.map((sh) => ({ team_id: t.id, at: sh.time, by: sh.by })),
        );
        if (rows.length) await supabase.from('shots').insert(rows);
        await supabase.from('meta').upsert({ id: META_ID, data: rosterFromState(seed) });
        scheduleRefetch();
      })();
      return;
    }
    setState((s) => {
      pushUndo({ type: 'local', teams: s.teams });
      return seed;
    });
  }, [pushUndo, scheduleRefetch]);

  const byId = useMemo(() => {
    const map = new Map(state.teams.map((t) => [t.id, t]));
    return (id) => map.get(id);
  }, [state.teams]);

  return {
    teams: state.teams,
    liveGames: state.liveGames,
    games: state.games,
    schedule: state.schedule,
    photographer,
    byId,
    toggleTeam,
    photographTeams,
    toggleRink,
    photographGame,
    loadSchedule,
    undo,
    canUndo,
    setPhotographer,
    importTeams,
    reset,
    // surfaced for the header connection indicator
    shared: isShared,
    online,
  };
}
