// MimiMétéo data layer — Open-Meteo (Météo-France model). Free, no key,
// CORS-open, called straight from the browser. Two upstreams:
//   - Geocoding: https://geocoding-api.open-meteo.com/v1/search
//   - Forecast : https://api.open-meteo.com/v1/meteofrance
import axios from 'axios';

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
// best_match: auto-picks the best model per location (Météo-France AROME/
// ARPEGE for France near-term) AND gives a full 14-day HOURLY range — the
// dedicated /meteofrance endpoint only returns ~4 days of hourly data.
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

// ─── City search ────────────────────────────────────────────────────────────
export async function searchCity(name) {
  if (!name || name.trim().length < 2) return [];
  const { data } = await axios.get(GEO_URL, {
    params: { name: name.trim(), count: 8, language: 'fr', format: 'json' },
  });
  return (data?.results || []).map((r) => ({
    id: r.id,
    name: r.name,
    lat: r.latitude,
    lon: r.longitude,
    country: r.country,
    countryCode: r.country_code,
    admin: r.admin1 || r.admin2 || '',
    postcode: Array.isArray(r.postcodes) ? r.postcodes[0] : null,
  }));
}

const MF_URL = 'https://api.open-meteo.com/v1/meteofrance';

// Overlay non-null values from `src` arrays onto `dst` arrays by index, for
// the given keys. Used to splice accurate Météo-France data over best_match.
function overlayArrays(dst, src, keys) {
  if (!dst || !src) return;
  for (const k of keys) {
    const s = src[k];
    const d = dst[k];
    if (!Array.isArray(s) || !Array.isArray(d)) continue;
    for (let i = 0; i < d.length && i < s.length; i++) {
      if (s[i] != null) d[i] = s[i];
    }
  }
}

// ─── Forecast ─────────────────────────────────────────────────────────────────
// Open-Meteo is free/keyless but rate-limited (HTTP 429), which bites when a few
// people browse at once. We cache each city's forecast in localStorage for
// ~10 min, retry transient failures with backoff, and fall back to a stale
// cache rather than surfacing an error.
const FORECAST_TTL = 10 * 60 * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fcKey = (lat, lon) => `meteo_fc_${lat.toFixed(3)}_${lon.toFixed(3)}`;

function readForecastCache(lat, lon, allowStale = false) {
  try {
    const raw = localStorage.getItem(fcKey(lat, lon));
    if (!raw) return null;
    const { t, data } = JSON.parse(raw);
    if (!allowStale && Date.now() - t > FORECAST_TTL) return null;
    return data;
  } catch { return null; }
}
function writeForecastCache(lat, lon, data) {
  try { localStorage.setItem(fcKey(lat, lon), JSON.stringify({ t: Date.now(), data })); } catch { /* quota/full — ignore */ }
}

export async function getForecast(lat, lon) {
  const fresh = readForecastCache(lat, lon);
  if (fresh) return fresh;

  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const data = await fetchForecast(lat, lon);
      writeForecastCache(lat, lon, data);
      return data;
    } catch (e) {
      lastErr = e;
      const status = e?.response?.status;
      const retriable = status === 429 || status === 503 || status >= 500 || status === undefined;
      if (!retriable) throw e;
      const stale = readForecastCache(lat, lon, true);
      if (stale) return stale; // better an old forecast than an error
      await sleep(700 * (attempt + 1));
    }
  }
  const stale = readForecastCache(lat, lon, true);
  if (stale) return stale;
  throw lastErr;
}

// Three sources merged for the best possible result:
//   • ECMWF IFS (base, 14 days): the best medium-range global model — temp,
//     precip, precip-probability, wind+gusts, CAPE. (No UV.)
//   • best_match: only used to fill UV (ECMWF doesn't output it).
//   • Météo-France (AROME/ARPEGE seamless, ~4 days): overlaid on the near
//     term for phone-accurate temps/sky/wind/precip.
async function fetchForecast(lat, lon) {
  const common = { latitude: lat, longitude: lon, timezone: 'auto', forecast_days: 14 };
  const [ecmwfRes, uvRes, mfRes] = await Promise.all([
    axios.get(FORECAST_URL, {
      params: {
        ...common,
        models: 'ecmwf_ifs025',
        current: [
          'temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'is_day',
          'precipitation', 'weather_code', 'wind_speed_10m', 'wind_gusts_10m',
        ].join(','),
        hourly: [
          'temperature_2m', 'apparent_temperature', 'precipitation_probability', 'precipitation',
          'weather_code', 'wind_speed_10m', 'wind_gusts_10m', 'wind_direction_10m', 'cape',
          'snowfall', 'snow_depth',
        ].join(','),
        daily: [
          'weather_code', 'temperature_2m_max', 'temperature_2m_min',
          'precipitation_sum', 'precipitation_probability_max',
          'wind_speed_10m_max', 'wind_gusts_10m_max', 'wind_direction_10m_dominant',
          'snowfall_sum', 'sunrise', 'sunset',
        ].join(','),
      },
    }),
    // UV only — ECMWF has none, so pull it from best_match.
    axios.get(FORECAST_URL, {
      params: { ...common, hourly: 'uv_index', daily: 'uv_index_max' },
    }).catch(() => null),
    // Météo-France accurate near-term overlay.
    axios.get(MF_URL, {
      params: {
        ...common,
        current: ['temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'precipitation', 'weather_code', 'wind_speed_10m', 'wind_gusts_10m'].join(','),
        hourly: ['temperature_2m', 'apparent_temperature', 'precipitation', 'weather_code', 'wind_speed_10m', 'wind_gusts_10m', 'wind_direction_10m', 'snowfall', 'snow_depth'].join(','),
        daily: ['temperature_2m_max', 'temperature_2m_min', 'weather_code', 'precipitation_sum', 'wind_speed_10m_max', 'wind_gusts_10m_max', 'wind_direction_10m_dominant', 'snowfall_sum'].join(','),
      },
    }).catch(() => null),
  ]);

  const data = ecmwfRes.data;

  // Splice UV from best_match into the ECMWF base.
  const uv = uvRes?.data;
  if (uv) {
    if (data.hourly && uv.hourly) data.hourly.uv_index = uv.hourly.uv_index;
    if (data.daily && uv.daily) data.daily.uv_index_max = uv.daily.uv_index_max;
  }

  // Overlay Météo-France for the trusted near term.
  const mf = mfRes?.data;
  if (mf) {
    if (mf.current?.temperature_2m != null) {
      for (const k of ['temperature_2m', 'apparent_temperature', 'weather_code', 'wind_speed_10m', 'wind_gusts_10m', 'relative_humidity_2m', 'precipitation']) {
        if (mf.current[k] != null) data.current[k] = mf.current[k];
      }
    }
    overlayArrays(data.hourly, mf.hourly, ['temperature_2m', 'apparent_temperature', 'weather_code', 'wind_speed_10m', 'wind_gusts_10m', 'wind_direction_10m', 'precipitation', 'snowfall', 'snow_depth']);
    overlayArrays(data.daily, mf.daily, ['temperature_2m_max', 'temperature_2m_min', 'weather_code', 'precipitation_sum', 'wind_speed_10m_max', 'wind_gusts_10m_max', 'wind_direction_10m_dominant', 'snowfall_sum']);
  }
  return data;
}

// ─── Air quality + pollen ────────────────────────────────────────────────────
const AQ_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine';

// Generic cached + retried GET (same rationale as getForecast: Open-Meteo 429s).
async function cachedFetch(key, ttl, fetcher) {
  const k = `meteo_${key}`;
  const read = () => { try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : null; } catch { return null; } };
  const cached = read();
  if (cached && Date.now() - cached.t < ttl) return cached.data;
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const data = await fetcher();
      try { localStorage.setItem(k, JSON.stringify({ t: Date.now(), data })); } catch { /* full */ }
      return data;
    } catch (e) {
      lastErr = e;
      const s = e?.response?.status;
      if (!(s === 429 || s === 503 || s >= 500 || s === undefined)) throw e;
      const stale = read();
      if (stale) return stale.data;
      await sleep(700 * (attempt + 1));
    }
  }
  const stale = read();
  if (stale) return stale.data;
  throw lastErr;
}

export function getAirQuality(lat, lon) {
  return cachedFetch(`aq_${lat.toFixed(3)}_${lon.toFixed(3)}`, FORECAST_TTL, async () => {
    const { data } = await axios.get(AQ_URL, {
      params: {
        latitude: lat, longitude: lon, timezone: 'auto',
        current: [
          'european_aqi', 'pm2_5', 'pm10', 'ozone', 'nitrogen_dioxide',
          'alder_pollen', 'birch_pollen', 'grass_pollen', 'mugwort_pollen', 'olive_pollen', 'ragweed_pollen',
        ].join(','),
      },
    });
    return data;
  });
}

// Marine forecast — only meaningful for coastal/sea points. Returns null when
// the location has no marine data (inland) instead of throwing.
export async function getMarine(lat, lon) {
  try {
    const data = await cachedFetch(`marine_${lat.toFixed(3)}_${lon.toFixed(3)}`, FORECAST_TTL, async () => {
      const res = await axios.get(MARINE_URL, {
        params: {
          latitude: lat, longitude: lon, timezone: 'auto',
          current: ['wave_height', 'wave_direction', 'wave_period', 'sea_surface_temperature'].join(','),
          daily: ['wave_height_max'].join(','),
        },
      });
      return res.data;
    });
    if (data?.current?.wave_height == null && data?.current?.sea_surface_temperature == null) return null;
    return data;
  } catch { return null; }
}

// European AQI → level (official CAQI bands).
export function aqiLevel(aqi) {
  if (aqi == null || Number.isNaN(aqi)) return null;
  if (aqi <= 20) return { label: 'Bon', color: '#22c55e', bgHex: '#14532d' };
  if (aqi <= 40) return { label: 'Moyen', color: '#84cc16', bgHex: '#1a2e05' };
  if (aqi <= 60) return { label: 'Dégradé', color: '#f59e0b', bgHex: '#431407' };
  if (aqi <= 80) return { label: 'Mauvais', color: '#ef4444', bgHex: '#450a0a' };
  if (aqi <= 100) return { label: 'Très mauvais', color: '#a855f7', bgHex: '#2e1065' };
  return { label: 'Extrême', color: '#9f1239', bgHex: '#4c0519' };
}

// Pollen concentration (grains/m³) → risk level (generic CAMS bands).
export function pollenLevel(v) {
  if (v == null) return RISK.FAIBLE;
  if (v >= 80) return RISK.EXTREME;
  if (v >= 30) return RISK.ELEVE;
  if (v >= 10) return RISK.MODERE;
  return RISK.FAIBLE;
}

export const POLLENS = [
  { key: 'grass_pollen', label: 'Graminées', icon: '🌾' },
  { key: 'birch_pollen', label: 'Bouleau', icon: '🌳' },
  { key: 'alder_pollen', label: 'Aulne', icon: '🌲' },
  { key: 'ragweed_pollen', label: 'Ambroisie', icon: '🌿' },
  { key: 'olive_pollen', label: 'Olivier', icon: '🫒' },
  { key: 'mugwort_pollen', label: 'Armoise', icon: '🌱' },
];

// ─── WMO weather codes → French label + emoji ────────────────────────────────
const WMO = {
  0:  ['Ciel clair', '☀️'],
  1:  ['Plutôt clair', '🌤️'],
  2:  ['Partiellement nuageux', '⛅'],
  3:  ['Couvert', '☁️'],
  45: ['Brouillard', '🌫️'],
  48: ['Brouillard givrant', '🌫️'],
  51: ['Bruine légère', '🌦️'],
  53: ['Bruine', '🌦️'],
  55: ['Bruine dense', '🌧️'],
  56: ['Bruine verglaçante', '🌧️'],
  57: ['Bruine verglaçante', '🌧️'],
  61: ['Pluie faible', '🌦️'],
  63: ['Pluie', '🌧️'],
  65: ['Forte pluie', '🌧️'],
  66: ['Pluie verglaçante', '🌧️'],
  67: ['Pluie verglaçante', '🌧️'],
  71: ['Neige faible', '🌨️'],
  73: ['Neige', '🌨️'],
  75: ['Forte neige', '❄️'],
  77: ['Grains de neige', '🌨️'],
  80: ['Averses', '🌦️'],
  81: ['Averses', '🌧️'],
  82: ['Averses violentes', '⛈️'],
  85: ['Averses de neige', '🌨️'],
  86: ['Averses de neige', '❄️'],
  95: ['Orage', '⛈️'],
  96: ['Orage + grêle', '⛈️'],
  99: ['Orage + grêle', '⛈️'],
};

export function wmo(code) {
  const [label, emoji] = WMO[code] || ['—', '🌡️'];
  return { label, emoji };
}

export function isStormCode(code) {
  return code === 95 || code === 96 || code === 99 || code === 82;
}

// ─── Risk levels — exact colours & thresholds from the original MimiMétéo ─────
// color = accent/text, bgHex = dark filled background (used by badges/tiles).
export const RISK = {
  FAIBLE:  { key: 'FAIBLE',  label: 'Faible',  color: '#22c55e', bgHex: '#14532d' },
  MODERE:  { key: 'MODERE',  label: 'Modéré',  color: '#f59e0b', bgHex: '#431407' },
  ELEVE:   { key: 'ELEVE',   label: 'Élevé',   color: '#ef4444', bgHex: '#450a0a' },
  EXTREME: { key: 'EXTREME', label: 'Extrême', color: '#a855f7', bgHex: '#2e1065' },
};

const ORDER = ['FAIBLE', 'MODERE', 'ELEVE', 'EXTREME'];
export function maxRisk(a, b) {
  return ORDER.indexOf(a.key) >= ORDER.indexOf(b.key) ? a : b;
}

export function windRisk(gustKmh) {
  if (gustKmh >= 90) return RISK.EXTREME;
  if (gustKmh >= 60) return RISK.ELEVE;
  if (gustKmh >= 30) return RISK.MODERE;
  return RISK.FAIBLE;
}

// mm per hour
export function rainRisk(mm) {
  if (mm >= 30) return RISK.EXTREME;
  if (mm >= 10) return RISK.ELEVE;
  if (mm >= 2) return RISK.MODERE;
  return RISK.FAIBLE;
}

export function uvRisk(uv) {
  if (uv >= 8) return RISK.EXTREME;
  if (uv >= 6) return RISK.ELEVE;
  if (uv >= 3) return RISK.MODERE;
  return RISK.FAIBLE;
}

// CAPE (J/kg) → storm risk (MUCAPE scale).
export function capeRisk(cape) {
  if (cape == null) return RISK.FAIBLE;
  if (cape >= 3000) return RISK.EXTREME;
  if (cape >= 1500) return RISK.ELEVE;
  if (cape >= 500) return RISK.MODERE;
  return RISK.FAIBLE;
}

// WMO thunderstorm codes → orage risk.
export function wmoOrageRisk(code) {
  if (code === 99) return RISK.EXTREME;
  if (code === 96) return RISK.ELEVE;
  if (code === 95) return RISK.MODERE;
  return RISK.FAIBLE;
}

// Combined hourly/daily storm risk: worst of WMO code and CAPE.
export function stormRisk(code, cape) {
  return maxRisk(wmoOrageRisk(code), capeRisk(cape ?? 0));
}

// Severe (violent) storm risk — hail-bearing codes.
export function severeStormRisk(code) {
  if (code === 99) return RISK.ELEVE;
  if (code === 96) return RISK.MODERE;
  return RISK.FAIBLE;
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
export function dirToCompass(deg) {
  if (deg == null) return '';
  return COMPASS[Math.round(((deg % 360) / 45)) % 8];
}

// Meteociel-style temperature colour scale: cold = violet/blue, mild =
// green/yellow, hot = orange/red, extreme = crimson.
export function tempColor(t) {
  if (t == null || Number.isNaN(t)) return '#94a3b8';
  if (t <= -10) return '#7c3aed';
  if (t <= -5) return '#4f46e5';
  if (t <= 0) return '#2563eb';
  if (t <= 4) return '#0ea5e9';
  if (t <= 8) return '#06b6d4';
  if (t <= 12) return '#14b8a6';
  if (t <= 15) return '#22c55e';
  if (t <= 18) return '#84cc16';
  if (t <= 21) return '#eab308';
  if (t <= 24) return '#f59e0b';
  if (t <= 28) return '#f97316';
  if (t <= 32) return '#ef4444';
  if (t <= 36) return '#dc2626';
  return '#be123c';
}

// ─── Live-map embed URLs (all iframe-friendly, no key) ───────────────────────
// RainViewer animated rain radar centred on the city.
export function rainviewerUrl(lat, lon, zoom = 8) {
  return `https://www.rainviewer.com/map.html?loc=${lat},${lon},${zoom}`
    + '&oFa=0&oC=0&oU=0&oCS=1&oF=0&oAP=1&c=3&o=83&lm=1&layer=radar&sm=1&sn=1&hu=false';
}

// Blitzortung live lightning map centred on a point (France-wide if zoomed out).
export function blitzortungUrl(lat, lon, zoom = 8) {
  return `https://map.blitzortung.org/#${zoom}/${lat}/${lon}`;
}

// Windy embed for wind / CAPE overlays.
export function windyUrl(lat, lon, overlay = 'wind', zoom = 7) {
  return `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}`
    + `&detailLat=${lat}&detailLon=${lon}&zoom=${zoom}&level=surface&overlay=${overlay}`
    + '&product=ecmwf&menu=&message=&marker=true&calendar=&pressure=&type=map'
    + '&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1';
}

// Official Météo-France vigilance map (opens in a new tab — the page blocks
// iframing and the embeddable data needs a token).
export const VIGILANCE_URL = 'https://vigilance.meteofrance.fr/fr';

// ─── Recent cities (localStorage, max 6) ─────────────────────────────────────
const LS_RECENT = 'mimimeteo.recent';

export function getRecentCities() {
  try { return JSON.parse(localStorage.getItem(LS_RECENT) || '[]'); } catch (_) { return []; }
}

export function addRecentCity(city) {
  try {
    const list = getRecentCities().filter((c) => !(c.lat === city.lat && c.lon === city.lon));
    list.unshift(city);
    localStorage.setItem(LS_RECENT, JSON.stringify(list.slice(0, 6)));
  } catch (_) { /* ignore */ }
}

// ─── Weather-alert cities (push notifs for rain/storm) ───────────────────────
const LS_ALERT_CITIES = 'mimimeteo.alertCities';

export function getAlertCities() {
  try { return JSON.parse(localStorage.getItem(LS_ALERT_CITIES) || '[]'); } catch (_) { return []; }
}

function sameCity(a, b) {
  return Math.abs(a.lat - b.lat) < 0.01 && Math.abs(a.lon - b.lon) < 0.01;
}

export function isAlertCity(lat, lon) {
  return getAlertCities().some((c) => sameCity(c, { lat, lon }));
}

// Toggle a city's weather-alert subscription. Returns the new list (max 20).
export function toggleAlertCity(city) {
  const list = getAlertCities();
  const exists = list.some((c) => sameCity(c, city));
  const next = exists
    ? list.filter((c) => !sameCity(c, city))
    : [{ name: city.name, lat: city.lat, lon: city.lon }, ...list].slice(0, 20);
  try { localStorage.setItem(LS_ALERT_CITIES, JSON.stringify(next)); } catch (_) { /* ignore */ }
  return next;
}
