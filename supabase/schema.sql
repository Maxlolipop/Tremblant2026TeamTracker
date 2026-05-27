-- Tremblant 2026 Tracker — shared backend schema.
--
-- Run this ONCE in your Supabase project: SQL Editor → New query → paste →
-- Run. It creates the two tables the app syncs through, opens them to the
-- public "anon" key (this is an internal team tool — anyone with the link can
-- read and mark), and turns on realtime so every phone updates live.

-- ── meta ────────────────────────────────────────────────────────────────────
-- One row (id = 'current') holding the roster + schedule as JSON. Written only
-- when someone imports a file or loads/refreshes the schedule, so concurrent
-- writes are rare and last-write-wins is fine here.
create table if not exists public.meta (
  id         text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ── shots ───────────────────────────────────────────────────────────────────
-- The hot table. Marking a team = INSERT one row; un-marking = DELETE its rows.
-- Append-only inserts mean two photographers tapping at the same moment can
-- never clobber each other's work — the dangerous part of a shared tracker.
create table if not exists public.shots (
  id         uuid primary key default gen_random_uuid(),
  team_id    text not null,
  at         text not null,          -- "HH:MM" wall-clock the shot was logged
  by         text not null,          -- photographer initials
  created_at timestamptz not null default now()
);

create index if not exists shots_team_id_idx on public.shots (team_id);

-- ── access ──────────────────────────────────────────────────────────────────
-- RLS is on, with wide-open policies for the anon key. Tighten later if you
-- ever need to (e.g. require auth), but for a weekend tournament tool this is
-- the "anyone with the URL can use it" behaviour we want.
alter table public.meta  enable row level security;
alter table public.shots enable row level security;

drop policy if exists "anon all on meta"  on public.meta;
drop policy if exists "anon all on shots" on public.shots;

create policy "anon all on meta"  on public.meta  for all
  to anon using (true) with check (true);
create policy "anon all on shots" on public.shots for all
  to anon using (true) with check (true);

-- ── realtime ──────────────────────────────────────────────────────────────--
-- Broadcast inserts/updates/deletes so the app can live-update without polling.
alter publication supabase_realtime add table public.shots;
alter publication supabase_realtime add table public.meta;
