import { COLORS, fonts, monoLabel, statusRing, statusFill } from './theme.js';

// Sketchy bordered box. status: 'shot' | 'unshot' | 'neutral'.
export function SketchBox({ children, style, status, dashed, thick, onClick }) {
  const ring = { shot: COLORS.shot, unshot: COLORS.unshot, neutral: COLORS.ink }[
    status || 'neutral'
  ];
  const fill = {
    shot: 'rgba(31,138,62,0.10)',
    unshot: 'rgba(200,52,31,0.08)',
    neutral: 'transparent',
  }[status || 'neutral'];

  return (
    <div
      onClick={onClick}
      data-status-box
      style={{
        position: 'relative',
        background: fill,
        border: `${thick ? 2 : 1.5}px ${dashed ? 'dashed' : 'solid'} ${ring}`,
        borderRadius: 6,
        padding: 10,
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: '1px 1px 0 rgba(0,0,0,0.06)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Round traffic-light status dot.
export function Dot({ shot, size = 12 }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: shot ? COLORS.shot : COLORS.unshot,
        border: '1.5px solid #1c1a17',
        verticalAlign: 'middle',
        flex: 'none',
      }}
    />
  );
}

// Handwritten heading with a wobbly hand-drawn underline.
export function PageHeader({ title, subtitle, right }) {
  const w = Math.max(title.length * 11, 80);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <div>
        <div style={monoLabel}>tracker · {subtitle}</div>
        <div style={{ fontFamily: fonts.hand, fontSize: 40, lineHeight: 1, marginTop: 2 }}>
          {title}
        </div>
        <svg width={w} height={8} style={{ marginTop: -2 }}>
          <path
            d={`M2 5 Q ${title.length * 3} 1, ${title.length * 6} 5 T ${w - 2} 4`}
            stroke={COLORS.ink}
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </div>
      {right}
    </div>
  );
}

// True once a team has at least one photo session logged.
export const isShot = (t) => (t?.shots?.length ?? 0) > 0;

// Compact list of photo-session timestamps (e.g. "09:12 · AM  +1").
export function ShotTimes({ shots, style }) {
  if (!shots?.length) return null;
  return (
    <div style={{ ...monoLabel, fontSize: 9, marginTop: 4, lineHeight: 1.5, ...style }}>
      {shots.map((s, i) => (
        <span key={i}>
          {i > 0 && <span style={{ opacity: 0.4 }}> · </span>}
          {s.time} · {s.by}
        </span>
      ))}
      {shots.length > 1 && (
        <span style={{ color: COLORS.shot, marginLeft: 6 }}>×{shots.length}</span>
      )}
    </div>
  );
}

// X-of-Y progress bar with a hatched track.
export function ProgressBar({ teams }) {
  const total = teams.length || 1;
  const done = teams.filter((t) => isShot(t)).length;
  const pct = Math.round((done / total) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: fonts.mono, fontSize: 11 }}>
      <span style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {done}/{teams.length}
      </span>
      <div
        style={{
          position: 'relative',
          flex: 1,
          minWidth: 90,
          height: 10,
          border: '1.5px solid #1c1a17',
          borderRadius: 4,
          background:
            'repeating-linear-gradient(135deg, transparent 0 4px, rgba(0,0,0,0.04) 4px 8px)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: COLORS.shot,
            borderRight: pct < 100 && pct > 0 ? '1.5px solid #1c1a17' : 'none',
            transition: 'width 0.25s ease',
          }}
        />
      </div>
      <span style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>{pct}%</span>
    </div>
  );
}

// Sketchy rounded search field that wraps a real input.
export function SearchBar({ placeholder = 'search teams…', value, onChange }) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        border: '1.5px solid #1c1a17',
        borderRadius: 20,
        padding: '6px 12px',
        background: 'rgba(255,255,255,0.6)',
        fontFamily: fonts.mono,
        fontSize: 12,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1c1a17" strokeWidth="2">
        <circle cx="10" cy="10" r="6" />
        <path d="M15 15 L20 20" strokeLinecap="round" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        style={{
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontFamily: fonts.mono,
          fontSize: 12,
          flex: 1,
          minWidth: 0,
          color: COLORS.ink,
        }}
      />
    </label>
  );
}

// Pill chip. Renders as a button when onClick is supplied.
export function Chip({ children, active, status, onClick, style }) {
  const colors =
    status === 'shot'
      ? { bg: '#d8efdd', border: COLORS.shot }
      : status === 'unshot'
        ? { bg: '#f8dcd6', border: COLORS.unshot }
        : active
          ? { bg: COLORS.ink, border: COLORS.ink, color: COLORS.paper }
          : { bg: 'transparent', border: COLORS.ink };
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        border: `1.5px solid ${colors.border}`,
        background: colors.bg,
        color: colors.color || COLORS.ink,
        borderRadius: 14,
        fontFamily: fonts.mono,
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

export const paperStyle = {
  background: COLORS.paper,
  backgroundImage: 'radial-gradient(rgba(0,0,0,0.05) 0.8px, transparent 0.8px)',
  backgroundSize: '14px 14px',
  fontFamily: fonts.body,
  color: COLORS.ink,
  position: 'relative',
  padding: 22,
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  borderRadius: 12,
  border: '1.5px solid rgba(0,0,0,0.12)',
  minHeight: '70vh',
};

export { statusRing, statusFill };
