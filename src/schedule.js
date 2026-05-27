// Live tournament schedule, pulled straight from the NBHPA admin site.
//
// The public schedule page (site_schedule.php) renders nothing useful on its
// own — the games are injected by an AJAX POST to site_schedule_include.php.
// That endpoint sends `access-control-allow-origin: *`, so the browser can
// call it directly: no proxy, no backend. We ask for the full-calendar
// ("list") view so we get every game regardless of the current date, then
// scrape the returned HTML into structured games. Re-fetching picks up any
// live changes (added teams, moved games, filled-in playoff brackets).

function collapse(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

// Pull the hidden form values the page would normally submit. Falls back to
// the ?league_id= query param if the input isn't present.
function readFormDefaults(pageHtml, pageUrl) {
  const grab = (name) => {
    const re = new RegExp(`name="${name}"[^>]*value="([^"]*)"`, 'i');
    const m = pageHtml.match(re);
    return m ? m[1] : '';
  };
  const url = new URL(pageUrl);
  return {
    seasonId: grab('season_id'),
    leagueId: grab('league_id') || url.searchParams.get('league_id') || '',
  };
}

// Parse the include-endpoint HTML into a flat list of games.
export function parseGames(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const rows = doc.querySelectorAll('tr.schedule_container');
  const games = [];

  rows.forEach((row) => {
    const rawCat = collapse(row.querySelector('.cat_name span')?.textContent).replace(/-\s*$/, '');
    const division = collapse(rawCat.split(' - ')[0]);

    // Team anchors appear several times per row (logo link, name link, and a
    // mobile-only duplicate). Keep the ones that carry a name, deduped by id
    // and in document order: first listed is the visitor, second the home.
    const teams = [];
    const seen = new Set();
    row.querySelectorAll('a[href*="/equipes/"]').forEach((a) => {
      const id = a.getAttribute('href').match(/\/equipes\/(\d+)/)?.[1];
      const name = collapse(a.textContent);
      if (!id || !name || seen.has(id)) return;
      seen.add(id);
      teams.push({ id, name });
    });

    // Two `.game_date` blocks: one holds the YYYY-MM-DD, the other the HH:MM.
    let date = '';
    let time = '';
    row.querySelectorAll('.game_date').forEach((el) => {
      const txt = collapse(el.textContent);
      const d = txt.match(/(\d{4}-\d{2}-\d{2})/);
      const t = txt.match(/\b(\d{1,2}:\d{2})\b/);
      if (d) date = d[1];
      else if (t) time = t[1];
    });

    const venue = collapse(row.querySelector('.game_venue')?.textContent);
    const id = row
      .querySelector('a[href*="/livegame/"], a[href*="/sommaire/"]')
      ?.getAttribute('href')
      .match(/\/(?:livegame|sommaire)\/(\d+)/)?.[1];

    // Skip placeholder bracket slots that don't have both teams yet — they'll
    // show up on a later refresh once the matchup is decided.
    if (teams.length < 2 || !id) return;

    games.push({
      id,
      division,
      label: rawCat,
      date,
      time,
      venue,
      t1: teams[0],
      t2: teams[1],
    });
  });

  return games;
}

// Collapse the games into a unique roster, keyed by the site's stable team id.
export function gamesToTeams(games) {
  const map = new Map();
  for (const g of games) {
    for (const t of [g.t1, g.t2]) {
      if (!map.has(t.id)) {
        map.set(t.id, { id: t.id, name: t.name, division: g.division, shots: [] });
      }
    }
  }
  return [...map.values()];
}

// Fetch + parse the whole schedule for a given public schedule URL.
export async function fetchSchedule(pageUrl) {
  const pageRes = await fetch(pageUrl, { credentials: 'omit' });
  if (!pageRes.ok) throw new Error(`schedule page returned ${pageRes.status}`);
  const pageHtml = await pageRes.text();
  const { seasonId, leagueId } = readFormDefaults(pageHtml, pageUrl);
  if (!leagueId) throw new Error('could not find a league_id on that page');

  const includeUrl = new URL('site_schedule_include.php', pageUrl).href;
  const today = new Date().toISOString().slice(0, 10);
  const body = new URLSearchParams({
    view: 'list',
    season_id: seasonId,
    category_id: '',
    'home||visitor': '',
    is_playoff: '',
    venue_id: '',
    datetime: today,
    league_id: leagueId,
    lang: 'fr',
  });

  const res = await fetch(includeUrl, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`schedule data returned ${res.status}`);

  const games = parseGames(await res.text());
  if (!games.length) throw new Error('no games found in the schedule response');
  return { games, seasonId, leagueId, url: pageUrl, fetchedAt: Date.now() };
}
