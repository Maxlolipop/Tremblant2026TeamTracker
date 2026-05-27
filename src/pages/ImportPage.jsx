import { useMemo, useRef, useState } from 'react';
import { PageHeader, SketchBox, Chip, paperStyle } from '../kit.jsx';
import { COLORS, fonts, monoLabel } from '../theme.js';

const DEFAULT_SCHEDULE_URL =
  'https://admin.nbhpa.com/sites/site_schedule.php?league_id=54&lang=fr';

// Pull the live NBHPA schedule straight off the public page. No file needed —
// re-loading later picks up any changes (new teams, moved games, brackets).
function ScheduleLoader({ tracker }) {
  const { loadSchedule, schedule, games } = tracker;
  const [url, setUrl] = useState(schedule?.url || DEFAULT_SCHEDULE_URL);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [count, setCount] = useState(null);

  async function load() {
    setBusy(true);
    setError(null);
    setCount(null);
    try {
      const n = await loadSchedule(url.trim());
      setCount(n);
    } catch (e) {
      setError(e.message || 'Could not load that schedule.');
    } finally {
      setBusy(false);
    }
  }

  const loaded = games?.length;
  return (
    <SketchBox style={{ padding: 14, background: '#fff' }}>
      <div style={{ fontFamily: fonts.hand, fontSize: 24, marginBottom: 6 }}>Load live schedule</div>
      <div style={{ ...monoLabel, textTransform: 'none', marginBottom: 8 }}>
        Paste the NBHPA schedule link — every game, team, time and rink is pulled in automatically.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          spellCheck={false}
          style={{
            flex: 1,
            minWidth: 220,
            border: '1.5px solid #1c1a17',
            borderRadius: 6,
            padding: '8px 10px',
            background: COLORS.paper,
            fontFamily: fonts.mono,
            fontSize: 12,
            color: COLORS.ink,
          }}
        />
        <button
          onClick={load}
          disabled={busy || !url.trim()}
          style={{
            padding: '8px 18px',
            border: '1.5px solid #1c1a17',
            background: busy ? 'rgba(0,0,0,0.15)' : COLORS.shot,
            color: COLORS.paper,
            borderRadius: 6,
            fontFamily: fonts.hand,
            fontSize: 20,
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          {busy ? 'loading…' : loaded ? 'refresh' : 'load schedule'}
        </button>
      </div>
      {error && (
        <div style={{ ...monoLabel, color: COLORS.unshot, textTransform: 'none', marginTop: 8 }}>
          ⚠ {error}
        </div>
      )}
      {count != null && (
        <div style={{ marginTop: 8 }}>
          <Chip status="shot">loaded ✓ {count} games</Chip>
        </div>
      )}
      {!count && loaded ? (
        <div style={{ ...monoLabel, textTransform: 'none', marginTop: 8 }}>
          {games.length} games loaded
          {schedule?.fetchedAt
            ? ` · synced ${new Date(schedule.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : ''}
        </div>
      ) : null}
    </SketchBox>
  );
}

const FIELDS = [
  { value: 'name', label: 'team name', required: true },
  { value: 'division', label: 'division', required: false },
  { value: 'rink', label: 'rink', required: false },
  { value: 'ignore', label: '— ignore —', required: false },
];

// Split a delimited file into a header + rows. Detects comma vs tab.
function parseDelimited(text) {
  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return { header: [], rows: [] };
  const delim = lines[0].includes('\t') ? '\t' : ',';
  const split = (l) => l.split(delim).map((c) => c.trim());
  const header = split(lines[0]);
  const rows = lines.slice(1).map(split);
  return { header, rows };
}

// Guess a sensible field for a column from its header text.
function guessField(headerName) {
  const h = (headerName || '').toLowerCase();
  if (/(name|team)/.test(h)) return 'name';
  if (/(div|pool|category|age)/.test(h)) return 'division';
  if (/(rink|ice|sheet)/.test(h)) return 'rink';
  return 'ignore';
}

// Import tournament — V2: drag-drop / browse a spreadsheet, map columns to
// fields, then import. Reads the file for real and builds the roster.
export default function ImportPage({ tracker }) {
  const { importTeams } = tracker;
  const fileInput = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState(null);
  const [parsed, setParsed] = useState(null); // { header, rows }
  const [mapping, setMapping] = useState([]); // field per column index
  const [error, setError] = useState(null);
  const [imported, setImported] = useState(false);

  function ingest(file) {
    setError(null);
    setImported(false);
    if (!file) return;
    const ok = /\.(csv|tsv|txt)$/i.test(file.name);
    if (!ok) {
      setFileName(file.name);
      setParsed(null);
      setError('Unsupported file. Export your spreadsheet to CSV (or TSV) and drop it here.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const p = parseDelimited(String(reader.result));
      if (!p.rows.length) {
        setError('No data rows found in that file.');
        setParsed(null);
        return;
      }
      setFileName(file.name);
      setParsed(p);
      setMapping(p.header.map(guessField));
    };
    reader.readAsText(file);
  }

  const ready = useMemo(() => {
    if (!parsed) return null;
    const nameCol = mapping.indexOf('name');
    if (nameCol === -1) return { error: 'Map one column to “team name”.' };
    const divCol = mapping.indexOf('division');
    const rinkCol = mapping.indexOf('rink');
    const rows = parsed.rows
      .map((r) => ({
        name: r[nameCol]?.trim(),
        division: divCol >= 0 ? r[divCol]?.trim() : '',
        rink: rinkCol >= 0 ? r[rinkCol]?.trim() : '',
      }))
      .filter((r) => r.name);
    const rinks = new Set(rows.map((r) => r.rink).filter(Boolean));
    return { rows, rinkCount: rinks.size };
  }, [parsed, mapping]);

  function doImport() {
    if (!ready || ready.error) return;
    importTeams(ready.rows);
    setImported(true);
  }

  function setColField(idx, value) {
    setMapping((m) => m.map((f, i) => (i === idx ? value : f)));
  }

  return (
    <div style={paperStyle}>
      <PageHeader title="Import tournament" subtitle="live schedule or spreadsheet" />

      <ScheduleLoader tracker={tracker} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 0, borderTop: '1.5px dashed rgba(0,0,0,0.3)' }} />
        <span style={monoLabel}>or upload a file</span>
        <div style={{ flex: 1, height: 0, borderTop: '1.5px dashed rgba(0,0,0,0.3)' }} />
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          ingest(e.dataTransfer.files?.[0]);
        }}
        style={{
          border: `2.5px dashed ${dragging ? COLORS.shot : COLORS.ink}`,
          borderRadius: 12,
          padding: 28,
          background: dragging ? 'rgba(31,138,62,0.06)' : 'rgba(255,255,255,0.6)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontFamily: fonts.hand, fontSize: 36, lineHeight: 1 }}>Drop your file here</div>
        <div style={{ ...monoLabel, marginTop: 6 }}>.csv · .tsv — or</div>
        <button
          onClick={() => fileInput.current?.click()}
          style={{
            marginTop: 10,
            padding: '8px 18px',
            border: '1.5px solid #1c1a17',
            background: COLORS.paper,
            borderRadius: 6,
            fontFamily: fonts.hand,
            fontSize: 20,
            cursor: 'pointer',
          }}
        >
          browse files
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,.tsv,.txt"
          style={{ display: 'none' }}
          onChange={(e) => ingest(e.target.files?.[0])}
        />
      </div>

      {fileName && (
        <div style={{ ...monoLabel, marginTop: 4 }}>
          ↓ detected: {fileName}
          {parsed ? ` · ${parsed.rows.length} rows` : ''}
        </div>
      )}

      {error && (
        <div style={{ ...monoLabel, color: COLORS.unshot, textTransform: 'none' }}>{error}</div>
      )}

      {/* Column mapping */}
      {parsed && (
        <SketchBox style={{ padding: 12, background: '#fff' }}>
          <div style={{ fontFamily: fonts.hand, fontSize: 22, marginBottom: 8 }}>Map columns</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {parsed.header.map((col, idx) => (
              <div
                key={idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 28px 150px',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  border: '1px dashed rgba(0,0,0,0.25)',
                  borderRadius: 4,
                  background: COLORS.paper,
                }}
              >
                <span style={monoLabel}>{col || `Column ${idx + 1}`}</span>
                <span style={{ fontFamily: fonts.hand, fontSize: 16, color: 'rgba(0,0,0,0.5)' }}>
                  e.g. “{parsed.rows[0]?.[idx] ?? ''}”
                </span>
                <span style={monoLabel}>→</span>
                <select
                  value={mapping[idx]}
                  onChange={(e) => setColField(idx, e.target.value)}
                  style={{
                    padding: '5px 8px',
                    border: '1.5px solid #1c1a17',
                    borderRadius: 4,
                    background: mapping[idx] === 'ignore' ? 'transparent' : COLORS.ink,
                    color: mapping[idx] === 'ignore' ? COLORS.ink : COLORS.paper,
                    fontFamily: fonts.hand,
                    fontSize: 16,
                    cursor: 'pointer',
                  }}
                >
                  {FIELDS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </SketchBox>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 'auto', flexWrap: 'wrap' }}>
        {ready && !ready.error && (
          <span style={{ ...monoLabel, color: COLORS.shot }}>
            ✓ ready · {ready.rows.length} teams
            {ready.rinkCount ? ` · ${ready.rinkCount} rinks` : ''}
          </span>
        )}
        {ready?.error && <span style={{ ...monoLabel, color: COLORS.unshot }}>{ready.error}</span>}
        {imported && <Chip status="shot">imported ✓</Chip>}
        <div style={{ flex: 1 }} />
        <button
          onClick={doImport}
          disabled={!ready || !!ready.error}
          style={{
            padding: '8px 18px',
            border: '1.5px solid #1c1a17',
            background: !ready || ready.error ? 'rgba(0,0,0,0.15)' : COLORS.shot,
            color: COLORS.paper,
            borderRadius: 6,
            fontFamily: fonts.hand,
            fontSize: 20,
            cursor: !ready || ready.error ? 'default' : 'pointer',
          }}
        >
          {ready && !ready.error ? `import ${ready.rows.length} teams ✓` : 'import teams ✓'}
        </button>
      </div>
    </div>
  );
}
