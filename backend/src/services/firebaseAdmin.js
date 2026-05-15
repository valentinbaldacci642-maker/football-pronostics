const logger = require('../utils/logger');

// Lazy-init firebase-admin. The SDK reads a service account JSON either
// from FIREBASE_SERVICE_ACCOUNT_JSON (raw JSON string or base64) or from
// the standard GOOGLE_APPLICATION_CREDENTIALS file path. We accept both
// because Render UI escapes newlines weirdly in raw JSON, so base64 is
// safer for env-var pasting.

let cachedApp = null;
let initAttempted = false;

function parseServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  const trimmed = raw.trim();
  // Try raw JSON first
  if (trimmed.startsWith('{')) {
    try { return JSON.parse(trimmed); } catch (_) { /* fall through */ }
  }
  // Otherwise treat as base64
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch (e) {
    logger.error('FIREBASE_SERVICE_ACCOUNT_JSON parse failed: ' + e.message);
    return null;
  }
}

function getApp() {
  if (cachedApp) return cachedApp;
  if (initAttempted) return null;
  initAttempted = true;

  let admin;
  try {
    admin = require('firebase-admin');
  } catch (e) {
    logger.warn('firebase-admin not installed — push notifications disabled');
    return null;
  }

  const svc = parseServiceAccount();
  if (!svc) {
    logger.warn('FIREBASE_SERVICE_ACCOUNT_JSON missing — push notifications disabled');
    return null;
  }

  try {
    cachedApp = admin.initializeApp({
      credential: admin.credential.cert(svc),
    });
    logger.info(`Firebase admin initialized for project ${svc.project_id}`);
    return cachedApp;
  } catch (e) {
    logger.error('Firebase admin init failed: ' + e.message);
    return null;
  }
}

function getMessaging() {
  const app = getApp();
  if (!app) return null;
  return require('firebase-admin').messaging(app);
}

module.exports = { getApp, getMessaging };
