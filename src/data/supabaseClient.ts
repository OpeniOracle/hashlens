// ---------------------------------------------------------------------------
// Supabase client (singleton)
// ---------------------------------------------------------------------------
// Reads the PUBLIC anon key from VITE_ env vars. If either var is missing,
// `supabase` is null and the app runs in local-only demo mode. The service
// role key must NEVER appear in client code — all privileged access happens
// behind Row Level Security.
// ---------------------------------------------------------------------------

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;

export const ENV_LABEL = import.meta.env.VITE_ENV_LABEL ?? 'local';
