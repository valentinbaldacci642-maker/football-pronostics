// Lightweight Open-Meteo client for weather push alerts. Free, no key.
const axios = require('axios');

const client = axios.create({ baseURL: 'https://api.open-meteo.com/v1', timeout: 10000 });

// Next-hours precipitation/storm outlook for a point.
async function getOutlook(lat, lon) {
  const { data } = await client.get('/forecast', {
    params: {
      latitude: lat,
      longitude: lon,
      timezone: 'auto',
      forecast_days: 2,
      hourly: 'precipitation,precipitation_probability,weather_code',
    },
  });
  return data;
}

// ─── Météo-France vigilance (via MeteoAlarm — free, no key, CORS-blocked so
//     proxied through the backend) ──────────────────────────────────────────
const METEOALARM_FR = 'https://feeds.meteoalarm.org/api/v1/warnings/feeds-france';
const GEO_GOUV = 'https://geo.api.gouv.fr/communes';

const AWARENESS_TYPES = {
  1: { label: 'Vent violent', icon: '💨' },
  2: { label: 'Neige / verglas', icon: '❄️' },
  3: { label: 'Orages', icon: '⛈️' },
  4: { label: 'Brouillard', icon: '🌫️' },
  5: { label: 'Canicule', icon: '🌡️' },
  6: { label: 'Grand froid', icon: '🥶' },
  7: { label: 'Vagues-submersion', icon: '🌊' },
  8: { label: 'Feux de forêt', icon: '🔥' },
  9: { label: 'Avalanches', icon: '🏔️' },
  10: { label: 'Pluie-inondation', icon: '🌧️' },
  11: { label: 'Inondation', icon: '💧' },
  12: { label: 'Pluie-inondation', icon: '🌧️' },
  13: { label: 'Vague de chaleur', icon: '🌡️' },
};
const LEVELS = {
  1: { level: 1, color: '#22c55e', label: 'Vert' },
  2: { level: 2, color: '#eab308', label: 'Jaune' },
  3: { level: 3, color: '#f97316', label: 'Orange' },
  4: { level: 4, color: '#ef4444', label: 'Rouge' },
};

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

// Reverse-geocode lat/lon → French department name (e.g. "Bouches-du-Rhône").
async function reverseDept(lat, lon) {
  const { data } = await axios.get(GEO_GOUV, {
    params: { lat, lon, fields: 'departement', format: 'json' },
    timeout: 8000,
  });
  return data?.[0]?.departement?.nom || null;
}

function parseParam(parameter, name) {
  const p = (parameter || []).find((x) => x.valueName === name);
  return p?.value || '';
}

// Active vigilance warnings for a department name. Returns [] when no warning.
async function getVigilance(depName) {
  if (!depName) return [];
  const target = norm(depName);
  const { data } = await axios.get(METEOALARM_FR, {
    headers: { 'User-Agent': 'SiteDesFoufous/1.0' },
    timeout: 12000,
  });
  // Le flux MeteoAlarm renvoie aussi des alertes passées (observé : alertes du
  // 18/05 encore présentes le 23/05) → on ne garde que celles ACTIVES : non
  // expirées et démarrées au plus tard en fin de journée courante. Sans ce
  // filtre, une vieille « Vigilance jaune orages » s'affiche alors que la
  // carte officielle Météo-France est verte.
  const now = Date.now();
  const eod = new Date(); eod.setHours(23, 59, 59, 999);
  const endOfToday = eod.getTime();

  const out = [];
  for (const w of (data?.warnings || [])) {
    const infos = w.alert?.info || [];
    const info = infos.find((i) => (i.language || '').toLowerCase().startsWith('fr')) || infos[0];
    if (!info) continue;
    const inDept = (info.area || []).some((a) => norm(a.areaDesc) === target);
    if (!inDept) continue;
    // Time window: skip expired warnings and warnings that only start after today.
    const exp = info.expires ? new Date(info.expires).getTime() : null;
    const ons = (info.onset || info.effective) ? new Date(info.onset || info.effective).getTime() : null;
    if (Number.isFinite(exp) && exp < now) continue;
    if (Number.isFinite(ons) && ons > endOfToday) continue;
    const lvlNum = parseInt(parseParam(info.parameter, 'awareness_level'), 10) || 1;
    const typeNum = parseInt(parseParam(info.parameter, 'awareness_type'), 10) || 0;
    const lvl = LEVELS[lvlNum] || LEVELS[1];
    const type = AWARENESS_TYPES[typeNum] || { label: info.event || 'Phénomène', icon: '⚠️' };
    out.push({
      type: type.label,
      icon: type.icon,
      level: lvl.level,
      levelLabel: lvl.label,
      color: lvl.color,
      event: info.event || '',
      from: info.onset || info.effective || null,
      until: info.expires || null,
    });
  }
  // Keep only real vigilance (yellow+); highest level first; dedup by type
  // keeping the worst level per phenomenon.
  const byType = new Map();
  for (const w of out) {
    if (w.level < 2) continue;
    const cur = byType.get(w.type);
    if (!cur || w.level > cur.level) byType.set(w.type, w);
  }
  return Array.from(byType.values()).sort((a, b) => b.level - a.level);
}

module.exports = { getOutlook, reverseDept, getVigilance };
