# Tournament Photo Tracker

A small webapp for tracking which teams have been photographed during a hockey
tournament. Works on phones, syncs live across the whole team, and installs to
the home screen like an app.

## Pages

- **Live** — one row per rink with the two teams side-by-side. Tap a rink to
  mark **both** its teams photographed in one go. Each team shows a
  traffic-light status (red = not yet, green = photographed) plus the time and
  photographer once shot.
- **Teams** — every team grouped by division, with a done/total count per
  division and an overall progress bar. Search to filter; tap a team to toggle
  its status.
- **Import** — load the live NBHPA schedule from a link, or drag-drop a
  `.csv` / `.tsv` roster and map the columns. A `rink` column auto-pairs teams
  into live games.

Set who's shooting with the initials box in the header — it's stamped onto
teams as you mark them, and is remembered per phone.

---

## Sharing it with the team (live sync)

By default the app saves only to the current device. To have **everyone see
the same progress update live**, point it at a free Supabase project. The badge
next to the title shows the current mode: `live · synced` vs `this device`.

### 1. Create the backend (once, ~3 min)

1. Go to [supabase.com](https://supabase.com), sign up, **New project**
   (the free tier is plenty). Pick a region near you and save the database
   password somewhere.
2. When it's ready, open **SQL Editor → New query**, paste the entire contents
   of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**. This
   creates the tables and turns on live updates.
3. Open **Settings → API** and copy two values:
   - **Project URL**
   - **Project API key** → the **`anon` / public** one (safe to ship publicly).

### 2. Deploy to Vercel (once, ~3 min)

1. Push this folder to a GitHub repo (or use the Vercel CLI / drag-drop).
2. On [vercel.com](https://vercel.com) → **Add New → Project** → import the
   repo. It auto-detects Vite; just click deploy.
3. In **Project → Settings → Environment Variables**, add the two keys from
   above and **redeploy**:

   | Name | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | the Project URL |
   | `VITE_SUPABASE_ANON_KEY` | the anon public key |

That's it — share the Vercel URL with the team. Anyone who opens it reads and
updates the same shared tournament.

### 3. Add it to a phone home screen

Open the URL on a phone:

- **iPhone (Safari):** Share button → **Add to Home Screen**.
- **Android (Chrome):** ⋮ menu → **Add to Home screen**.

It then opens full-screen with its own icon, no browser bars — the closest a
web app gets to a native app.

> **About a true home-screen *widget*** (a live tile showing the count without
> opening the app): iOS and Android only allow those from native apps, so it's
> not possible from a web app without a separate native build. The installed
> shortcut above is the practical equivalent.

---

## Develop

```sh
npm install
cp .env.example .env   # optional: fill in Supabase keys for shared mode locally
npm run dev            # start the dev server
npm run build          # production build into dist/
npm run preview        # preview the production build
```

With no `.env`, the app runs in single-device localStorage mode — handy for
trying it out before setting up the backend.

## How sync works

State is split into two pieces (see [`src/store.js`](src/store.js)):

- **Roster + schedule** live in one `meta` row as JSON. They change only when
  someone imports a file or loads the schedule.
- **Marks** are append-only rows in a `shots` table. Marking a team inserts a
  row rather than overwriting state, so two photographers tapping at the same
  moment can never wipe out each other's work. Realtime pushes every change to
  all open phones.

When no Supabase keys are present, the same state is persisted to
`localStorage` instead, and the public API is identical.

## Stack

Vite + React (no UI framework) + Supabase (Postgres + realtime). The sketchy /
low-fi look — Caveat + Patrick Hand fonts, traffic-light colors, hand-drawn
borders — lives in `src/theme.js` and `src/kit.jsx`.
