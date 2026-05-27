import { createClient } from '@supabase/supabase-js';

// The backend is optional. When the two env vars are present (set in Vercel,
// or a local .env), the app runs in *shared* mode: every photographer reads
// and writes the same Supabase project, so progress syncs live across phones.
// When they're absent, `supabase` is null and the store falls back to
// localStorage — the app still works, it's just single-device.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        realtime: { params: { eventsPerSecond: 5 } },
      })
    : null;

export const isShared = Boolean(supabase);
