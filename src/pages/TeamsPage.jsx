import { useMemo, useState } from 'react';
import { PageHeader, SketchBox, Chip, Dot, ProgressBar, SearchBar, ShotTimes, isShot, paperStyle } from '../kit.jsx';
import { fonts, monoLabel } from '../theme.js';

// All teams — V1: grouped by division, each division showing its done/total
// count. Tapping a team toggles its photographed status (handy for the
// coordinator fixing up records); search and the filter chips narrow which
// teams are visible. Search, status, and photographer filters AND-combine;
// the per-division count always reflects the full division so the progress
// reference stays stable while filtering.
export default function TeamsPage({ tracker }) {
  const { teams, toggleTeam } = tracker;
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all'); // 'all' | 'shot' | 'unshot'
  const [photographer, setPhotographer] = useState('all'); // 'all' | initials

  const divisions = useMemo(() => [...new Set(teams.map((t) => t.division))], [teams]);
  // Photographers seen across all logged shots, for the photographer chips.
  const photographers = useMemo(
    () => [...new Set(teams.flatMap((t) => (t.shots ?? []).map((s) => s.by)))].sort(),
    [teams],
  );
  const q = query.trim().toLowerCase();

  const matches = (t) => {
    if (q && !t.name.toLowerCase().includes(q)) return false;
    if (status === 'shot' && !isShot(t)) return false;
    if (status === 'unshot' && isShot(t)) return false;
    if (photographer !== 'all' && !(t.shots ?? []).some((s) => s.by === photographer))
      return false;
    return true;
  };

  return (
    <div style={paperStyle}>
      <PageHeader title="All teams" subtitle="by division" right={<ProgressBar teams={teams} />} />

      <div style={{ maxWidth: 320 }}>
        <SearchBar value={query} onChange={setQuery} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        <span style={{ ...monoLabel, marginRight: 2 }}>status</span>
        <Chip status={status === 'shot' ? 'shot' : undefined} onClick={() => setStatus(status === 'shot' ? 'all' : 'shot')}>
          shot
        </Chip>
        <Chip status={status === 'unshot' ? 'unshot' : undefined} onClick={() => setStatus(status === 'unshot' ? 'all' : 'unshot')}>
          unshot
        </Chip>
        {photographers.length > 0 && (
          <>
            <span style={{ ...monoLabel, marginLeft: 8, marginRight: 2 }}>by</span>
            {photographers.map((p) => (
              <Chip
                key={p}
                active={photographer === p}
                onClick={() => setPhotographer(photographer === p ? 'all' : p)}
              >
                {p}
              </Chip>
            ))}
          </>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {divisions.map((div) => {
          const list = teams.filter((t) => t.division === div);
          const visible = list.filter(matches);
          if (!visible.length) return null;
          const done = list.filter((t) => isShot(t)).length;
          return (
            <div key={div}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontFamily: fonts.hand, fontSize: 26, lineHeight: 1 }}>{div}</span>
                <div style={{ flex: 1, height: 0, borderTop: '1.5px dashed rgba(0,0,0,0.3)' }} />
                <span style={monoLabel}>
                  {done}/{list.length}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {visible.map((t) => (
                  <SketchBox
                    key={t.id}
                    status={isShot(t) ? 'shot' : 'unshot'}
                    onClick={() => toggleTeam(t.id)}
                    style={{ padding: '8px 12px', minWidth: 120 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Dot shot={isShot(t)} />
                      <span style={{ fontFamily: fonts.hand, fontSize: 22, lineHeight: 1 }}>
                        {t.name}
                      </span>
                    </div>
                    <ShotTimes shots={t.shots} />
                  </SketchBox>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
