// Durable storage for FCM push tokens, via the Supabase REST API (PostgREST).
// Without this, tokens live only in memory and every Render restart/deploy wipes
// them → notifications silently stop until each device re-opens the app.
//
// Requires env vars on the backend:
//   SUPABASE_URL          e.g. https://xxxx.supabase.co
//   SUPABASE_SERVICE_KEY  (service_role key — bypasses RLS) — or SUPABASE_ANON_KEY
//
// Table (run once in the Supabase SQL editor):
//   create table if not exists public.push_tokens (
//     token text primary key,
//     data jsonb not null default '{}'::jsonb,
//     updated_at timestamptz not null default now()
//   );
//   alter table public.push_tokens enable row level security;
//
// If it's not configured, every function is a safe no-op (in-memory fallback).
const axios = require('axios');
const logger = require('../utils/logger');

const BASE = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
const enabled = !!(BASE && KEY);
const REST = enabled ? `${BASE}/rest/v1/push_tokens` : null;
const HEADERS = enabled ? { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' } : {};

async function loadAll() {
  if (!enabled) return [];
  try {
    const { data } = await axios.get(`${REST}?select=token,data`, { headers: HEADERS, timeout: 12000 });
    return Array.isArray(data) ? data : [];
  } catch (e) {
    logger.warn('tokenStore.loadAll failed: ' + (e?.response?.status || e?.message || e));
    return [];
  }
}

async function save(token, meta) {
  if (!enabled || !token) return;
  try {
    await axios.post(
      REST,
      [{ token, data: meta, updated_at: new Date().toISOString() }],
      { headers: { ...HEADERS, Prefer: 'resolution=merge-duplicates' }, timeout: 12000 },
    );
  } catch (e) {
    logger.warn('tokenStore.save failed: ' + (e?.response?.status || e?.message || e));
  }
}

async function remove(token) {
  if (!enabled || !token) return;
  try {
    await axios.delete(`${REST}?token=eq.${encodeURIComponent(token)}`, { headers: HEADERS, timeout: 12000 });
  } catch (e) {
    logger.warn('tokenStore.remove failed: ' + (e?.response?.status || e?.message || e));
  }
}

module.exports = { enabled, loadAll, save, remove };
