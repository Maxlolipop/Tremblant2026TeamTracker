# Config-driven multi-tournament support

**Date:** 2026-06-03
**Status:** Approved

## Goal

Let the same codebase be deployed as a second, standalone app for the WBHF World
Championships tournament (`https://admin.wbhfworldchampionships.com/sites/site_schedule.php?league_id=3&lang=en`),
with its own Supabase + Vercel project, without forking the code or adding an
in-app tournament switcher.

## Context

The current app scrapes the NBHPA admin platform's `site_schedule_include.php`
AJAX endpoint (CORS-open) and parses the returned HTML into games/teams. The
WBHF site runs the **same platform**, verified on 2026-06-03:

- Same `site_schedule.php?league_id=…&lang=…` page shape and hidden
  `season_id` / `league_id` form fields.
- Same CORS-open `site_schedule_include.php` POST endpoint (`access-control-allow-origin: *`).
- Same `.cat_name`, `.game_date`, `.game_venue` classes and `/livegame/`,
  `/sommaire/` game-id links.
- **One difference:** team links use `/teams/<id>` (English site) instead of
  `/equipes/<id>` (French NBHPA site).
- Uses `lang=en` rather than `lang=fr`.

Branding is currently hardcoded: header text "tremblant 2026" (`src/App.jsx`),
page `<title>` (`index.html`), and "nbhpa schedule" copy in
`src/pages/ImportPage.jsx` / `src/pages/LivePage.jsx`.

## Changes

### 1. Parser (`src/schedule.js`) — required

- Match both team-link path styles: change the selector from
  `a[href*="/equipes/"]` to also match `/teams/`, and update the id regex to
  `/\/(?:equipes|teams)\/(\d+)/`.
- Replace the hardcoded `lang: 'fr'` in the POST body with the `lang` query
  param read from the schedule page URL, defaulting to `fr` when absent.
  `readFormDefaults` already parses the URL — extend it to also return `lang`.

Net effect: one scraper works unmodified against both tournaments.

### 2. Config via Vite env vars (same pattern as Supabase)

- `VITE_DEFAULT_SCHEDULE_URL` — replaces the hardcoded `DEFAULT_SCHEDULE_URL`
  in `src/pages/ImportPage.jsx`. Falls back to the existing NBHPA URL when
  unset, so the existing deployment is unchanged.
- `VITE_APP_TITLE` — replaces the "tremblant 2026" header text in
  `src/App.jsx` and drives the page `<title>` in `index.html`. Falls back to
  the current values when unset.
- Generic copy: "nbhpa schedule" / "Paste the NBHPA schedule link" →
  neutral wording ("live schedule" / "Paste the schedule link") in
  `ImportPage.jsx` and `LivePage.jsx`.
- `.env.example` documents the two new vars.

For Vite, `index.html` cannot read `import.meta.env` directly; the page
`<title>` is set at runtime from `VITE_APP_TITLE` (e.g. in `src/main.jsx` via
`document.title`), with the static `<title>` as the fallback.

### 3. No data-model changes

Each deployment has its own Supabase, so no per-tournament separation in the DB.
The `tremblant-tracker-v1` localStorage key is unchanged (separate domain =
separate storage). Out of scope.

## Out of scope

- In-app tournament switcher / picker.
- Shared backend across tournaments.
- Renaming the localStorage key.
- Any refactor beyond the points above.

## Verification

- WBHF URL loads in the app: games parse with both teams, divisions, times,
  rinks; team count > 0 (confirms the `/teams/` selector fix).
- NBHPA URL still loads unchanged (regression check).
- With env vars unset, default URL and title match today's behavior.
- With `VITE_DEFAULT_SCHEDULE_URL` / `VITE_APP_TITLE` set, the input prefills
  the WBHF URL and the header/page title reflect the configured value.
