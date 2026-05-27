import { useMemo, useState } from 'react';
import { PageHeader, SketchBox, Dot, ProgressBar, SearchBar, ShotTimes, isShot, paperStyle } from '../kit.jsx';
import { fonts, monoLabel } from '../theme.js';

// All teams — V1: grouped by division, each division showing its done/total
// count. Tapping a team toggles its photographed status (handy for the
// coordinator fixing up records); search filters across all divisions.
export default function TeamsPage({ tracker }) {
  const { teams, toggleTeam } = tracker;
  const [query, setQuery] = useState('');

  const divisions = useMemo(() => [...new Set(teams.map((t) => t.division))], [teams]);
  const q = query.trim().toLowerCase();

  return (
    <div style={paperStyle}>
      <PageHeader title="All teams" subtitle="by division" right={<ProgressBar teams={teams} />} />

      <div style={{ maxWidth: 320 }}>
        <SearchBar value={query} onChange={setQuery} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {divisions.map((div) => {
          const list = teams.filter((t) => t.division === div);
          const visible = q ? list.filter((t) => t.name.toLowerCase().includes(q)) : list;
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
