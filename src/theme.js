// Shared visual language, carried over from the wireframe kit.
// Sketchy / low-fi: handwritten headers (Caveat), body in Patrick Hand,
// labels in mono. Traffic-light status: red = not photographed, green = done.

export const COLORS = {
  ink: '#1c1a17',
  paper: '#fbfaf6',
  canvas: '#f0eee9',
  shot: '#1f8a3e',
  unshot: '#c8341f',
  annotation: '#7a3e0e',
};

export const fonts = {
  hand: '"Caveat", cursive',
  body: '"Patrick Hand", "Kalam", system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
};

export const monoLabel = {
  fontFamily: fonts.mono,
  fontSize: 11,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  color: 'rgba(0,0,0,0.55)',
};

export const statusRing = (shot) => (shot ? COLORS.shot : COLORS.unshot);
export const statusFill = (shot) =>
  shot ? 'rgba(31,138,62,0.10)' : 'rgba(200,52,31,0.08)';
