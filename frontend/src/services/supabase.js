import { createClient } from '@supabase/supabase-js';

// Optional cloud-sync layer. The app works fully offline / anonymous —
// Supabase is only used when the user explicitly creates an account.
// If env vars are missing, exports null and the auth flow stays hidden.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Fetch the current user's saved data blob (single-row jsonb store).
 * Returns { bankroll, history, favorites, ... } or null if no data yet.
 */
export async function fetchUserData(userId) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('user_data')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[supabase] fetchUserData error:', error.message);
    return null;
  }
  return data?.data || null;
}

/**
 * Push the user's full data blob. Single-row upsert keyed on user_id.
 */
export async function pushUserData(userId, data) {
  if (!supabase || !userId) return false;
  const { error } = await supabase
    .from('user_data')
    .upsert({ user_id: userId, data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) {
    console.warn('[supabase] pushUserData error:', error.message);
    return false;
  }
  return true;
}
