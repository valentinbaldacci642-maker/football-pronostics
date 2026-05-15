import { Capacitor } from '@capacitor/core';
import { notificationsApi } from './api';

// Lazy-import the plugin so the web build doesn't try to bundle native
// bindings. On web the plugin no-ops and registration is skipped.
let PushNotifications = null;

const LS_KEY = 'pushNotifs.enabled';
const LS_TOKEN_KEY = 'pushNotifs.lastToken';

export function isNotificationsEnabled() {
  // Default ON for native platforms, OFF for web (no FCM channel).
  const stored = localStorage.getItem(LS_KEY);
  if (stored != null) return stored === '1';
  return Capacitor.isNativePlatform();
}

export function setNotificationsEnabled(on) {
  localStorage.setItem(LS_KEY, on ? '1' : '0');
}

async function getPlugin() {
  if (PushNotifications) return PushNotifications;
  try {
    const mod = await import('@capacitor/push-notifications');
    PushNotifications = mod.PushNotifications;
    return PushNotifications;
  } catch (_) {
    return null;
  }
}

/**
 * Request permission, register the device with FCM, ship the token to
 * the backend. Idempotent — safe to call on every app launch. Re-sending
 * an already-known token is a no-op server-side (Map upsert).
 */
export async function initPushNotifications() {
  if (!Capacitor.isNativePlatform()) return { ok: false, reason: 'web' };
  if (!isNotificationsEnabled()) return { ok: false, reason: 'disabled' };

  const Push = await getPlugin();
  if (!Push) return { ok: false, reason: 'plugin-missing' };

  try {
    const perm = await Push.checkPermissions();
    let granted = perm.receive === 'granted';
    if (!granted) {
      const r = await Push.requestPermissions();
      granted = r.receive === 'granted';
    }
    if (!granted) return { ok: false, reason: 'permission-denied' };

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
      await notificationsApi.register(token, Capacitor.getPlatform());
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
