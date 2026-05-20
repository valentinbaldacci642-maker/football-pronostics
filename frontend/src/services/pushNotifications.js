import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { notificationsApi } from './api';
import { useFavoriteTeamsStore, useFavoritesStore } from '../store';

// Static import so Capacitor can wire the plugin bridge at JS init time.
// On web the plugin's stub no-ops, so we gate the *runtime* behavior on
// Capacitor.isNativePlatform() instead of trying to skip the import.

const LS_KEY = 'pushNotifs.enabled';
const LS_TOKEN_KEY = 'pushNotifs.lastToken';
const LS_PREFS_KEY = 'pushNotifs.prefs';

// Per-type notification preferences. All default ON. Keys must match the
// backend NOTIF_PREF_KEYS.
export const NOTIF_TYPES = [
  { key: 'vb',        label: 'Value bets',          desc: 'Nouveau value bet ≥ 6% détecté' },
  { key: 'favTeamVb', label: 'Value bet sur mon équipe', desc: 'Un value bet tombe sur une équipe favorite' },
  { key: 'favTeam',   label: 'Équipe favorite joue', desc: '2h avant un match d’une équipe favorite' },
  { key: 'favMatch',  label: 'Match favori',         desc: '15 min avant un match mis en favori' },
  { key: 'kickoff',   label: 'Coup d’envoi',         desc: 'Au coup d’envoi d’un match suivi' },
  { key: 'goal',      label: 'But en direct',        desc: 'À chaque but d’un match suivi' },
  { key: 'final',     label: 'Résultat final',       desc: 'Score final d’un match suivi' },
];

export function getNotifPrefs() {
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(LS_PREFS_KEY) || '{}'); } catch (_) { stored = {}; }
  const out = {};
  for (const { key } of NOTIF_TYPES) out[key] = stored[key] !== false; // default true
  return out;
}

export function setNotifPref(key, value) {
  const prefs = getNotifPrefs();
  prefs[key] = !!value;
  try { localStorage.setItem(LS_PREFS_KEY, JSON.stringify(prefs)); } catch (_) { /* ignore */ }
  return prefs;
}

// Read the current favorite team IDs from the persisted store.
function currentFavoriteTeamIds() {
  try {
    return (useFavoriteTeamsStore.getState().favoriteTeams || [])
      .map((t) => t.id)
      .filter((id) => Number.isFinite(id));
  } catch (_) {
    return [];
  }
}

// Read the current favorite match (fixture) IDs from the persisted store.
function currentFavoriteMatchIds() {
  try {
    return (useFavoritesStore.getState().favorites || [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id));
  } catch (_) {
    return [];
  }
}

export function isNotificationsEnabled() {
  // Default ON for native platforms, OFF for web (no FCM channel).
  const stored = localStorage.getItem(LS_KEY);
  if (stored != null) return stored === '1';
  return Capacitor.isNativePlatform();
}

export function setNotificationsEnabled(on) {
  localStorage.setItem(LS_KEY, on ? '1' : '0');
}

/**
 * Request permission, register the device with FCM, ship the token to
 * the backend. Idempotent — safe to call on every app launch. Re-sending
 * an already-known token is a no-op server-side (Map upsert).
 */
export async function initPushNotifications() {
  if (!Capacitor.isNativePlatform()) return { ok: false, reason: 'web' };
  if (!isNotificationsEnabled()) return { ok: false, reason: 'disabled' };

  const Push = PushNotifications;

  try {
    const perm = await Push.checkPermissions();
    let granted = perm.receive === 'granted';
    if (!granted) {
      const r = await Push.requestPermissions();
      granted = r.receive === 'granted';
    }
    if (!granted) return { ok: false, reason: 'permission-denied' };

    // Create the notification channels we target from the backend FCM
    // payloads. On Android 8+ a notification whose channelId doesn't exist
    // may be dropped, so we register them up front. Idempotent.
    try {
      await Push.createChannel({
        id: 'value_bets', name: 'Value bets',
        description: 'Nouveaux value bets détectés', importance: 4, visibility: 1,
      });
      await Push.createChannel({
        id: 'favorite_teams', name: 'Équipes favorites',
        description: 'Quand une équipe favorite joue aujourd’hui', importance: 4, visibility: 1,
      });
    } catch (_) { /* channels API unavailable on some devices — ignore */ }

    // The 'registration' listener fires with the FCM device token.
    // It's the only place to grab it — there's no synchronous getter.
    const tokenPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Token registration timed out')), 15000);
      Push.addListener('registration', (t) => {
        clearTimeout(timeout);
        resolve(t?.value || null);
      });
      Push.addListener('registrationError', (err) => {
        clearTimeout(timeout);
        reject(new Error(err?.error || 'registrationError'));
      });
    });

    await Push.register();
    const token = await tokenPromise;
    if (!token) return { ok: false, reason: 'no-token' };

    // Persist last-seen token so we can unregister cleanly later if the
    // user disables notifs from Settings.
    localStorage.setItem(LS_TOKEN_KEY, token);

    try {
      await notificationsApi.register(
        token, Capacitor.getPlatform(), currentFavoriteTeamIds(), currentFavoriteMatchIds(), getNotifPrefs()
      );
    } catch (e) {
      // Backend down → don't block the app, retry next launch
      console.warn('[push] register backend call failed:', e?.message);
    }

    // Foreground notifs: when the app is open, Android delivers them via
    // this event instead of the system tray. We could surface a toast here
    // later — for v1, just log so debug is easy.
    Push.addListener('pushNotificationReceived', (notif) => {
      console.log('[push] received foreground:', notif);
    });

    return { ok: true, token };
  } catch (e) {
    console.warn('[push] init failed:', e?.message);
    return { ok: false, reason: 'init-error', error: e?.message };
  }
}

/**
 * Disable notifications: tell the backend to drop our token, clear local
 * flag. The OS-level permission stays granted (user keeps that control
 * in system settings) but the device stops appearing in the broadcast list.
 */
export async function disablePushNotifications() {
  setNotificationsEnabled(false);
  const token = localStorage.getItem(LS_TOKEN_KEY);
  if (token) {
    try { await notificationsApi.unregister(token); } catch (_) {}
  }
  localStorage.removeItem(LS_TOKEN_KEY);
}

/** Re-enable + register again. */
export async function enablePushNotifications() {
  setNotificationsEnabled(true);
  return initPushNotifications();
}

/**
 * Re-send the current favorite teams + matches to the backend using the
 * stored token. Called whenever the user adds/removes a favorite team or
 * match so the reminder notifications stay in sync without a full
 * re-registration. No-op on web or when notifications are off / no token.
 */
export async function syncFavoriteTeamsToBackend() {
  if (!Capacitor.isNativePlatform()) return;
  if (!isNotificationsEnabled()) return;
  const token = localStorage.getItem(LS_TOKEN_KEY);
  if (!token) return;
  try {
    await notificationsApi.register(
      token, Capacitor.getPlatform(), currentFavoriteTeamIds(), currentFavoriteMatchIds(), getNotifPrefs()
    );
  } catch (e) {
    console.warn('[push] favorite sync failed:', e?.message);
  }
}
