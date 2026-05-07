import { create } from 'zustand';
import { supabase, isSupabaseConfigured, fetchUserData, pushUserData } from './supabase';
import { useBankrollStore, useHistoryStore, useFavoritesStore, useFavoriteTeamsStore } from '../store';

// Auth state (zustand). Holds the current Supabase session + sync status.
export const useAuthStore = create((set) => ({
  session: null,
  user: null,
  loading: true,
  syncing: false,
  lastSyncAt: null,
  enabled: isSupabaseConfigured,
  setSession: (session) => set({ session, user: session?.user || null }),
  setLoading: (loading) => set({ loading }),
  setSyncing: (syncing) => set({ syncing }),
  setLastSyncAt: (ts) => set({ lastSyncAt: ts }),
}));

/**
 * Snapshot every persisted store the cloud should sync. Keep symmetric with
 * applySnapshot below.
 */
function buildSnapshot() {
  return {
    version: 1,
    bankroll: useBankrollStore.getState(),
    history: { entries: useHistoryStore.getState().entries },
    favorites: { favorites: useFavoritesStore.getState().favorites },
    favoriteTeams: { favoriteTeams: useFavoriteTeamsStore.getState().favoriteTeams },
  };
}

function applySnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return;
  if (snapshot.bankroll) {
    const bk = useBankrollStore.getState();
    if (typeof snapshot.bankroll.initialBankroll === 'number') bk.setInitialBankroll(snapshot.bankroll.initialBankroll);
    if (typeof snapshot.bankroll.kellyFraction === 'number') bk.setKellyFraction(snapshot.bankroll.kellyFraction);
    if (typeof snapshot.bankroll.edgeMode === 'string') bk.setEdgeMode(snapshot.bankroll.edgeMode);
  }
  if (snapshot.history?.entries && Array.isArray(snapshot.history.entries)) {
    useHistoryStore.setState({ entries: snapshot.history.entries });
  }
  if (snapshot.favorites?.favorites && Array.isArray(snapshot.favorites.favorites)) {
    useFavoritesStore.setState({ favorites: snapshot.favorites.favorites });
  }
  if (snapshot.favoriteTeams?.favoriteTeams && Array.isArray(snapshot.favoriteTeams.favoriteTeams)) {
    useFavoriteTeamsStore.setState({ favoriteTeams: snapshot.favoriteTeams.favoriteTeams });
  }
}

/**
 * Pull cloud snapshot for the current user and merge with local. Strategy:
 * 'cloud-wins' for first sync after login (ensures consistent state across
 * devices); use 'local-wins' on the import flow when the user keeps local data.
 */
export async function pullFromCloud(strategy = 'cloud-wins') {
  const { user } = useAuthStore.getState();
  if (!user) return false;
  useAuthStore.getState().setSyncing(true);
  try {
    const cloud = await fetchUserData(user.id);
    if (cloud && strategy === 'cloud-wins') {
      applySnapshot(cloud);
    } else if (!cloud && strategy === 'cloud-wins') {
      // No cloud data yet — push current local up so future logins get it
      await pushUserData(user.id, buildSnapshot());
    }
    useAuthStore.getState().setLastSyncAt(Date.now());
    return true;
  } finally {
    useAuthStore.getState().setSyncing(false);
  }
}

/** Push the current local snapshot to the cloud (debounced upstream). */
export async function pushToCloud() {
  const { user } = useAuthStore.getState();
  if (!user) return false;
  useAuthStore.getState().setSyncing(true);
  try {
    const ok = await pushUserData(user.id, buildSnapshot());
    if (ok) useAuthStore.getState().setLastSyncAt(Date.now());
    return ok;
  } finally {
    useAuthStore.getState().setSyncing(false);
  }
}

/**
 * Init: subscribe to auth state changes + push to cloud whenever a tracked
 * store mutates. Call once at app boot.
 */
let pushTimer = null;
const schedulePush = () => {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { pushToCloud().catch(() => {}); }, 1500);
};

let initialized = false;
export function initCloudSync() {
  if (initialized || !supabase) return;
  initialized = true;

  // Restore session
  supabase.auth.getSession().then(({ data }) => {
    useAuthStore.getState().setSession(data.session || null);
    useAuthStore.getState().setLoading(false);
    if (data.session) pullFromCloud('cloud-wins').catch(() => {});
  });

  // Listen for auth changes
  supabase.auth.onAuthStateChange((event, session) => {
    useAuthStore.getState().setSession(session || null);
    if (event === 'SIGNED_IN' && session) {
      pullFromCloud('cloud-wins').catch(() => {});
    }
  });

  // Auto-push on store changes (debounced)
  useBankrollStore.subscribe(schedulePush);
  useHistoryStore.subscribe(schedulePush);
  useFavoritesStore.subscribe(schedulePush);
  useFavoriteTeamsStore.subscribe(schedulePush);
}

// Auth helpers
export async function signUp(email, password) {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
}

export async function signIn(email, password) {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}
