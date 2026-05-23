import { create } from 'zustand';
import { Capacitor } from '@capacitor/core';
import { supabase, isSupabaseConfigured, fetchUserData, pushUserData } from './supabase';
import { useBankrollStore, useHistoryStore, useFavoritesStore, useFavoriteTeamsStore } from '../store';

// Per-platform reconcile strategy for boot/resume:
//  - Native app (phone): 'cloud-wins' — the device is a viewer that mirrors the
//    cloud (= whatever the website, the editor, last pushed).
//  - Web (the site): 'newest-wins' — the editor must never have its data
//    overwritten by a stale cloud; it keeps local and pushes its edits up.
const DEFAULT_PULL_STRATEGY = Capacitor.isNativePlatform() ? 'cloud-wins' : 'newest-wins';

// Wall-clock timestamp (ms) of the last *local* user change to a synced store.
// Persisted so it survives reloads. Compared against the cloud snapshot's own
// `modifiedAt` so the most recently edited version wins — a stale device can no
// longer clobber fresher cloud data (and vice-versa).
const MODIFIED_KEY = 'pronostats-sync-modified-at';
function getLocalModifiedAt() {
  try { return parseInt(localStorage.getItem(MODIFIED_KEY) || '0', 10) || 0; } catch { return 0; }
}
function setLocalModifiedAt(ts) {
  try { localStorage.setItem(MODIFIED_KEY, String(ts)); } catch { /* no storage (SSR/tests) */ }
}

// True while we're writing cloud data into local stores. Suppresses the
// auto-push subscriber so applying a pulled snapshot doesn't bump the local
// modified time or schedule a redundant push back up.
let applyingRemote = false;

// Gate: no AUTOMATIC push happens until we've reconciled with the cloud at
// least once this session. Without this, the app's own startup writes (bet
// auto-resolution, date backfills, saving today's pronos…) fire before the
// initial pull and would push this device's possibly-stale state UP, clobbering
// good cloud data. Manual "Forcer une sync" (pushToCloud) is NOT gated.
let initialPullDone = false;

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
export function buildSnapshot() {
  const bk = useBankrollStore.getState();
  return {
    version: 2,
    // Stamp the snapshot with the data's own last-modified time so the other
    // device can tell whether this is newer than what it holds.
    modifiedAt: getLocalModifiedAt() || Date.now(),
    bankroll: {
      initialBankrollUnibet: bk.initialBankrollUnibet,
      initialBankrollWinamax: bk.initialBankrollWinamax,
      kellyFraction: bk.kellyFraction,
      edgeMode: bk.edgeMode,
      defaultBookmaker: bk.defaultBookmaker,
    },
    history: { entries: useHistoryStore.getState().entries },
    favorites: { favorites: useFavoritesStore.getState().favorites },
    favoriteTeams: { favoriteTeams: useFavoriteTeamsStore.getState().favoriteTeams },
  };
}

export function applySnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return;
  applyingRemote = true;
  try {
    if (snapshot.bankroll) {
      const bk = useBankrollStore.getState();
      const b = snapshot.bankroll;
      // Current schema: per-bookmaker bankrolls. Fall back to the legacy single
      // `initialBankroll` field (mapped onto Unibet) for old cloud blobs.
      if (typeof b.initialBankrollUnibet === 'number') bk.setInitialBankrollUnibet(b.initialBankrollUnibet);
      else if (typeof b.initialBankroll === 'number') bk.setInitialBankrollUnibet(b.initialBankroll);
      if (typeof b.initialBankrollWinamax === 'number') bk.setInitialBankrollWinamax(b.initialBankrollWinamax);
      if (typeof b.kellyFraction === 'number') bk.setKellyFraction(b.kellyFraction);
      if (typeof b.edgeMode === 'string') bk.setEdgeMode(b.edgeMode);
      if (b.defaultBookmaker === 'unibet' || b.defaultBookmaker === 'winamax') bk.setDefaultBookmaker(b.defaultBookmaker);
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
  } finally {
    applyingRemote = false;
  }
}

/**
 * Pull cloud snapshot for the current user and reconcile with local.
 *
 * Strategies:
 *  - 'cloud-wins' (default): take the cloud as source of truth on this device.
 *    Used at boot, on resume and after sign-in. The user edits mostly on one
 *    device (the website); every other device mirrors the cloud. Combined with
 *    the `initialPullDone` push-gate, a freshly-opened device can never push its
 *    startup/stale state up before it has reconciled with the cloud.
 *  - 'newest-wins': apply the cloud only if its `modifiedAt` is newer than our
 *    local edit time; otherwise push local up. Available for callers that want
 *    to protect known-newer local edits (not used by the automatic flows).
 */
export async function pullFromCloud(strategy = 'cloud-wins') {
  const { user } = useAuthStore.getState();
  if (!user) return false;
  useAuthStore.getState().setSyncing(true);
  try {
    const cloud = await fetchUserData(user.id);
    if (!cloud) {
      // No cloud data yet — push current local up so future logins get it.
      if (!getLocalModifiedAt()) setLocalModifiedAt(Date.now());
      await pushUserData(user.id, buildSnapshot());
    } else if (strategy === 'cloud-wins') {
      applySnapshot(cloud);
      setLocalModifiedAt(Number(cloud.modifiedAt) || Date.now());
    } else {
      // 'newest-wins'
      const cloudTs = Number(cloud.modifiedAt) || 0;
      const localTs = getLocalModifiedAt();
      if (cloudTs >= localTs) {
        applySnapshot(cloud);
        setLocalModifiedAt(cloudTs || Date.now());
      } else {
        await pushUserData(user.id, buildSnapshot());
      }
    }
    useAuthStore.getState().setLastSyncAt(Date.now());
    return true;
  } finally {
    // After the first reconcile, automatic pushes are safe to run.
    initialPullDone = true;
    useAuthStore.getState().setSyncing(false);
  }
}

/** Re-pull on app resume / focus using the platform-appropriate strategy. */
export function resyncFromCloud() {
  return pullFromCloud(DEFAULT_PULL_STRATEGY);
}

/** Push the current local snapshot to the cloud (debounced upstream). */
export async function pushToCloud() {
  const { user } = useAuthStore.getState();
  if (!user) return false;
  useAuthStore.getState().setSyncing(true);
  try {
    if (!getLocalModifiedAt()) setLocalModifiedAt(Date.now());
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

// Called on every mutation of a synced store. Ignores changes that come from
// applying a pulled cloud snapshot; otherwise records the edit time and queues
// a debounced push.
const onLocalChange = () => {
  if (applyingRemote) return;
  if (!initialPullDone) return; // don't push startup/stale state before the first cloud reconcile
  setLocalModifiedAt(Date.now());
  schedulePush();
};

let initialized = false;
export function initCloudSync() {
  if (initialized || !supabase) return;
  initialized = true;

  // Restore session
  supabase.auth.getSession().then(({ data }) => {
    useAuthStore.getState().setSession(data.session || null);
    useAuthStore.getState().setLoading(false);
    // Boot: phone mirrors cloud; site keeps/pushes its own data.
    if (data.session) pullFromCloud(DEFAULT_PULL_STRATEGY).catch(() => {});
    else initialPullDone = true; // no account → nothing to reconcile; allow local-only use
  });

  // Listen for auth changes
  supabase.auth.onAuthStateChange((event, session) => {
    useAuthStore.getState().setSession(session || null);
    if (event === 'SIGNED_IN' && session) {
      // Explicit sign-in: take the account's cloud data on this device.
      pullFromCloud('cloud-wins').catch(() => {});
    }
  });

  // Auto-push on store changes (debounced, skips snapshot-application writes)
  useBankrollStore.subscribe(onLocalChange);
  useHistoryStore.subscribe(onLocalChange);
  useFavoritesStore.subscribe(onLocalChange);
  useFavoriteTeamsStore.subscribe(onLocalChange);
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
