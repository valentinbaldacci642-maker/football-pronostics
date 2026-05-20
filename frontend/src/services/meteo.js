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

// ─── Forecast ─────────────────────────────────────────────────────────────────
export async function getForecast(lat, lon) {
  const { data } = await axios.get(FORECAST_URL, {
    params: {
      latitude: lat,
      longitude: lon,
      timezone: 'auto',
      forecast_days: 14,
      current: [
        'temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'is_day',
        'precipitation', 'weather_code', 'wind_speed_10m', 'wind_gusts_10m',
      ].join(','),
      hourly: [
        'temperature_2m', 'apparent_temperature', 'precipitation_probability', 'precipitation',
        'weather_code', 'wind_speed_10m', 'wind_gusts_10m', 'uv_index', 'cape',
      ].join(','),
      daily: [
        'weather_code', 'temperature_2m_max', 'temperature_2m_min',
        'precipitation_sum', 'precipitation_probability_max',
        'wind_speed_10m_max', 'wind_gusts_10m_max', 'uv_index_max',
        'sunrise', 'sunset',
      ].join(','),
    },
  });
  return data;
}

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

// ─── Risk levels (shared color code with MimiMétéo) ──────────────────────────
export const RISK = {
  FAIBLE:  { label: 'Faible',  color: '#22c55e', bg: 'bg-green-500/15',  text: 'text-green-400',  border: 'border-green-500/30' },
  MODERE:  { label: 'Modéré',  color: '#f59e0b', bg: 'bg-amber-500/15',  text: 'text-amber-400',  border: 'border-amber-500/30' },
  ELEVE:   { label: 'Élevé',   color: '#ef4444', bg: 'bg-red-500/15',    text: 'text-red-400',    border: 'border-red-500/30' },
  EXTREME: { label: 'Extrême', color: '#a855f7', bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
};

export function windRisk(gustKmh) {
  if (gustKmh >= 100) return RISK.EXTREME;
  if (gustKmh >= 80) return RISK.ELEVE;
  if (gustKmh >= 60) return RISK.MODERE;
  return RISK.FAIBLE;
}

export function rainRisk(mm) {
  if (mm >= 30) return RISK.EXTREME;
  if (mm >= 10) return RISK.ELEVE;
  if (mm >= 2) return RISK.MODERE;
  return RISK.FAIBLE;
}

export function uvRisk(uv) {
  if (uv >= 11) return RISK.EXTREME;
  if (uv >= 8) return RISK.ELEVE;
  if (uv >= 6) return RISK.MODERE;
  return RISK.FAIBLE;
}

export function stormRisk(code, precipProb) {
  if (code === 96 || code === 99) return RISK.EXTREME;
  if (code === 95) return RISK.ELEVE;
  if (code === 82 || (precipProb != null && precipProb >= 60)) return RISK.MODERE;
  return RISK.FAIBLE;
}

// CAPE-based storm risk (J/kg), same scale as MimiMétéo's MUCAPE tiles.
export function capeRisk(cape) {
  if (cape == null) return RISK.FAIBLE;
  if (cape >= 3000) return RISK.EXTREME;
  if (cape >= 1500) return RISK.ELEVE;
  if (cape >= 500) return RISK.MODERE;
  return RISK.FAIBLE;
}

// Severe-storm potential: high CAPE + a thunderstorm actually forecast.
export function severeStormRisk(cape, code) {
  const stormy = code === 95 || code === 96 || code === 99 || code === 82;
  if (cape >= 2500 && (code === 96 || code === 99)) return RISK.EXTREME;
  if (cape >= 2000 && stormy) return RISK.ELEVE;
  if (cape >= 1200 && stormy) return RISK.MODERE;
  if (cape >= 2500) return RISK.MODERE;
  return RISK.FAIBLE;
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
