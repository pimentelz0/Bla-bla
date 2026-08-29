import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase credentials provided by user
export const SUPABASE_URL =
  (import.meta as any).env?.VITE_SUPABASE_URL || 'https://myoicywulrrzfohlsjfe.supabase.co';

export const SUPABASE_ANON_KEY =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_-O-nGwbzijL96e0vOrDTyw_kmiA-eCn';

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

