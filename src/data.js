// Seed data, mirroring the wireframe sample so a fresh install has something
// to look at. Real tournaments replace this via the Import page.

export const SEED_TEAMS = [
  // U10
  { id: 't01', name: 'Hawks', division: 'U10', shot: true, time: '09:12', by: 'AM' },
  { id: 't02', name: 'Bears', division: 'U10', shot: true, time: '09:14', by: 'AM' },
  { id: 't03', name: 'Wolves', division: 'U10', shot: false, time: null, by: null },
  { id: 't04', name: 'Foxes', division: 'U10', shot: false, time: null, by: null },
  { id: 't05', name: 'Eagles', division: 'U10', shot: true, time: '10:40', by: 'JS' },
  { id: 't06', name: 'Owls', division: 'U10', shot: false, time: null, by: null },
  // U12
  { id: 't07', name: 'Ravens', division: 'U12', shot: true, time: '09:36', by: 'JS' },
  { id: 't08', name: 'Otters', division: 'U12', shot: true, time: '09:38', by: 'JS' },
  { id: 't09', name: 'Lynx', division: 'U12', shot: false, time: null, by: null },
  { id: 't10', name: 'Bison', division: 'U12', shot: true, time: '11:02', by: 'AM' },
  { id: 't11', name: 'Coyotes', division: 'U12', shot: false, time: null, by: null },
  { id: 't12', name: 'Moose', division: 'U12', shot: true, time: '11:18', by: 'KR' },
  { id: 't13', name: 'Salmon', division: 'U12', shot: false, time: null, by: null },
  // U14
  { id: 't14', name: 'Titans', division: 'U14', shot: false, time: null, by: null },
  { id: 't15', name: 'Comets', division: 'U14', shot: false, time: null, by: null },
  { id: 't16', name: 'Storm', division: 'U14', shot: true, time: '08:48', by: 'KR' },
  { id: 't17', name: 'Dragons', division: 'U14', shot: true, time: '08:50', by: 'KR' },
  { id: 't18', name: 'Vipers', division: 'U14', shot: false, time: null, by: null },
  { id: 't19', name: 'Sharks', division: 'U14', shot: true, time: '12:04', by: 'AM' },
  { id: 't20', name: 'Falcons', division: 'U14', shot: false, time: null, by: null },
];

// Currently-on-ice matchups (rink → two team ids).
export const SEED_LIVE_GAMES = [
  { rink: 'A', home: 't03', away: 't04' }, // Wolves vs Foxes  — both not shot
  { rink: 'B', home: 't07', away: 't08' }, // Ravens vs Otters — both shot
  { rink: 'C', home: 't14', away: 't16' }, // Titans (no) vs Storm (yes) — split
  { rink: 'D', home: 't11', away: 't12' }, // Coyotes (no) vs Moose (yes) — split
];
