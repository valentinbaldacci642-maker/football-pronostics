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
  const [ecmwfRes, uvRes, mfRes, convRes] = await Promise.all([
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
          'apparent_temperature_max', 'apparent_temperature_min',
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
        daily: ['temperature_2m_max', 'temperature_2m_min', 'apparent_temperature_max', 'apparent_temperature_min', 'weather_code', 'precipitation_sum', 'wind_speed_10m_max', 'wind_gusts_10m_max', 'wind_direction_10m_dominant', 'snowfall_sum'].join(','),
      },
    }).catch(() => null),
    // Keraunos-style convective ingredients (GFS): lifted index, CIN, and the
    // multi-level winds we need for deep-layer shear (sfc→500hPa) AND for
    // Storm-Relative Helicity 0-3km (needs wind on the low/mid troposphere
    // profile to assess rotation = tornadic potential). ECMWF doesn't expose
    // these via the open hourly endpoint, so we pull them from best_match.
    // Failure here just degrades severe/tornadic risk back to CAPE-only.
    axios.get(FORECAST_URL, {
      params: {
        ...common,
        hourly: [
          'lifted_index', 'convective_inhibition',
          // 950 + 900 = couche 0-1 km, le vrai prédicteur tornadique
          'wind_speed_950hPa', 'wind_direction_950hPa',
          'wind_speed_900hPa', 'wind_direction_900hPa',
          'wind_speed_925hPa', 'wind_direction_925hPa',
          'wind_speed_850hPa', 'wind_direction_850hPa',
          'wind_speed_700hPa', 'wind_direction_700hPa',
          'wind_speed_500hPa', 'wind_direction_500hPa',
        ].join(','),
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

  // Splice convective ingredients (lifted index, CIN, 500hPa wind) into ECMWF.
  const conv = convRes?.data;
  if (conv?.hourly && data.hourly) {
    for (const k of ['lifted_index', 'convective_inhibition', 'wind_speed_500hPa', 'wind_direction_500hPa']) {
      if (conv.hourly[k]) data.hourly[k] = conv.hourly[k];
    }
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
    overlayArrays(data.daily, mf.daily, ['temperature_2m_max', 'temperature_2m_min', 'apparent_temperature_max', 'apparent_temperature_min', 'weather_code', 'precipitation_sum', 'wind_speed_10m_max', 'wind_gusts_10m_max', 'wind_direction_10m_dominant', 'snowfall_sum']);
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

// Pleines/basses mers depuis la série horaire sea_level_height_msl.
// Trouve les extrema locaux (pic = entouré de valeurs plus basses, creux =
// entouré de valeurs plus hautes). La marée a un cycle d'environ 12h25, donc
// on s'attend à ~2 hautes et ~2 basses par 24h. La précision est limitée à
// l'heure (Open-Meteo ne sert pas en sous-horaire), suffisant pour un usage
// récréatif "pleine mer vers 14h, 4.2 m".
export function computeTides(times, heights) {
  if (!Array.isArray(times) || !Array.isArray(heights) || times.length < 3) return [];
  const out = [];
  for (let i = 1; i < heights.length - 1; i++) {
    const h = heights[i];
    if (h == null) continue;
    const prev = heights[i - 1];
    const next = heights[i + 1];
    if (prev == null || next == null) continue;
    if (h > prev && h > next) {
      out.push({ type: 'high', time: times[i], height: h });
    } else if (h < prev && h < next) {
      out.push({ type: 'low', time: times[i], height: h });
    }
  }
  return out;
}

// Phase de lune simplifiée (algo Meeus tronqué). Retourne un objet :
//   { age: jours depuis nouvelle lune (0-29.5),
//     illum: fraction éclairée 0-1,
//     name: 'Nouvelle' | 'Premier croissant' | 'Premier quartier' | ...,
//     emoji: '🌑' à '🌘' }
// Précision ~±0.5 jour, largement suffisant pour les conseils pêche.
export function moonPhase(date = new Date()) {
  // Synodic month length and known new moon reference (2000-01-06 18:14 UTC).
  const SYNODIC = 29.530588853;
  const REF = Date.UTC(2000, 0, 6, 18, 14) / 86400000;
  const days = date.getTime() / 86400000 - REF;
  const age = ((days % SYNODIC) + SYNODIC) % SYNODIC;
  // Fraction illuminée approximée par 0.5 * (1 - cos(2π * age / synodic)).
  const illum = 0.5 * (1 - Math.cos((2 * Math.PI * age) / SYNODIC));
  const phases = [
    { max: 1.5,  name: 'Nouvelle lune',     emoji: '🌑' },
    { max: 7.4,  name: 'Premier croissant', emoji: '🌒' },
    { max: 8.9,  name: 'Premier quartier',  emoji: '🌓' },
    { max: 14.8, name: 'Gibbeuse croissante', emoji: '🌔' },
    { max: 16.3, name: 'Pleine lune',       emoji: '🌕' },
    { max: 22.1, name: 'Gibbeuse décroissante', emoji: '🌖' },
    { max: 23.6, name: 'Dernier quartier',  emoji: '🌗' },
    { max: 29.6, name: 'Dernier croissant', emoji: '🌘' },
  ];
  const ph = phases.find((p) => age < p.max) || phases[0];
  return { age, illum, name: ph.name, emoji: ph.emoji };
}

// Note pêche d'un créneau de marée (1-5 étoiles). Basée sur :
//  - coeff (gros coeff = brassage = poissons actifs)
//  - phase lune (nouvelle/pleine = vives-eaux + activité solunaire max)
//  - type marée (PM légèrement favorisé pour la surfcasting)
export function fishingRating(coeff, moonIllum, type) {
  let score = 2; // base : créneau de marée correct
  if (coeff != null) {
    if (coeff >= 95) score += 2;        // grande marée
    else if (coeff >= 70) score += 1;   // bonne marée
    else if (coeff < 40) score -= 1;    // morte-eau
  }
  // Bonus lune : éclairée à >0.95 ou <0.05 (pleine ou nouvelle) = solunaire max
  if (moonIllum != null) {
    if (moonIllum > 0.95 || moonIllum < 0.05) score += 1;
    else if (moonIllum > 0.85 || moonIllum < 0.15) score += 0.5;
  }
  if (type === 'high') score += 0.3; // léger bonus PM
  return Math.max(1, Math.min(5, Math.round(score)));
}

// Estimation du coefficient de marée (échelle SHOM Brest 20-120) à partir
// de l'amplitude de la marée du jour. C'est une approximation : le vrai
// coefficient se calcule depuis les composantes harmoniques M2/S2/N2/K1...
// Sur la côte FR : amplitude ~1.5m (mortes-eaux) → coeff 20-40, amplitude
// ~6m (vives-eaux d'équinoxe) → coeff 95-120. Cale différemment selon le
// port (Brest amplitude max 8m, Marseille 0.4m → on normalise par l'amplitude
// max observée localement sur la période fetch).
export function estimateCoeff(tides) {
  if (!tides || tides.length < 2) return null;
  // Cherche la plus grande amplitude high-low consécutive du jour.
  let maxAmpl = 0;
  for (let i = 0; i < tides.length - 1; i++) {
    const dh = Math.abs(tides[i + 1].height - tides[i].height);
    if (dh > maxAmpl) maxAmpl = dh;
  }
  if (maxAmpl <= 0) return null;
  // Référence Brest : amplitude max ~7m = coeff ~115, amplitude min ~1m = coeff ~20.
  // Échelle linéaire grossière (pas calibrée par port — donne un ordre de
  // grandeur fiable pour Atlantique/Manche, sous-estimé en Méditerranée).
  const REF_AMPL_MIN = 1.0;
  const REF_AMPL_MAX = 7.0;
  const coeff = 20 + 95 * (maxAmpl - REF_AMPL_MIN) / (REF_AMPL_MAX - REF_AMPL_MIN);
  return Math.round(Math.max(20, Math.min(120, coeff)));
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
          // sea_level_height_msl inclut la marée + l'effet barométrique inverse.
          // En cherchant ses min/max horaires on retrouve pleines/basses mers.
          hourly: ['sea_level_height_msl'].join(','),
          daily: ['wave_height_max'].join(','),
          forecast_days: 3,
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

// Lifted Index (°C, more negative = more unstable). Standard SPC/Keraunos
// thresholds: <=−7 extreme, <=−5 strong, <=−3 moderate, else faible.
export function liftedRisk(li) {
  if (li == null) return RISK.FAIBLE;
  if (li <= -7) return RISK.EXTREME;
  if (li <= -5) return RISK.ELEVE;
  if (li <= -3) return RISK.MODERE;
  return RISK.FAIBLE;
}

// Helpers for converting wind speed+direction to u/v components in m/s.
// Meteorological convention: dir = direction wind comes FROM, so u (east)
// and v (north) are negative of sin/cos.
function windUV(spdKmh, dir) {
  if (spdKmh == null || dir == null) return null;
  const ms = spdKmh / 3.6;
  const r = (dir * Math.PI) / 180;
  return { u: -ms * Math.sin(r), v: -ms * Math.cos(r) };
}

// Storm-Relative Helicity 0-3 km (m²/s²). Measures the rotation potential
// of the low-mid troposphere — proxy for tornadic / supercell-favouring
// environments. Storm motion is estimated via the 30R75 method (Maddox 1976):
// 30° to the right of the mean 0-6km wind, at 75% of its speed.
//
// Standard SPC thresholds (for the magnitude):
//   <100  = weak rotation
//   100-150 = marginal supercell
//   150-250 = supercell probable
//   >=250 = tornadic potential
//
// Returns null if any required level is missing.
export function computeSRH(sfcSpdKmh, sfcDir, w925Spd, w925Dir, w850Spd, w850Dir, w700Spd, w700Dir, w500Spd, w500Dir) {
  const sfc = windUV(sfcSpdKmh, sfcDir);
  const w925 = windUV(w925Spd, w925Dir);
  const w850 = windUV(w850Spd, w850Dir);
  const w700 = windUV(w700Spd, w700Dir);
  const w500 = windUV(w500Spd, w500Dir);
  if (!sfc || !w925 || !w850 || !w700 || !w500) return null;

  // Mean 0-6km wind (unweighted average of the 5 levels — coarse but
  // adequate at this resolution; a proper pressure-weighted mean would
  // need full sounding data).
  const levels = [sfc, w925, w850, w700, w500];
  const meanU = levels.reduce((s, l) => s + l.u, 0) / levels.length;
  const meanV = levels.reduce((s, l) => s + l.v, 0) / levels.length;

  // 30R75 storm motion: rotate mean wind 30° clockwise, scale by 0.75.
  // Rotation of (u,v) by angle θ clockwise: (u·cosθ + v·sinθ, −u·sinθ + v·cosθ).
  const theta = (30 * Math.PI) / 180;
  const cos = Math.cos(theta), sin = Math.sin(theta);
  const cu = 0.75 * (meanU * cos + meanV * sin);
  const cv = 0.75 * (-meanU * sin + meanV * cos);

  // SRH = Σ over layers in [0, 3km] of (du * (v_n - cv) - dv * (u_n - cu)).
  // Levels covering 0-3km: sfc (10m) → 925 (~770m) → 850 (~1500m) → 700 (~3000m).
  const layers = [sfc, w925, w850, w700];
  let srh = 0;
  for (let i = 0; i < layers.length - 1; i++) {
    const du = layers[i + 1].u - layers[i].u;
    const dv = layers[i + 1].v - layers[i].v;
    srh += du * (layers[i].v - cv) - dv * (layers[i].u - cu);
  }
  return srh;
}

// Storm-Relative Helicity 0-1 km — the true tornadic predictor (rotation
// at the surface, not just somewhere aloft). Same algorithm as computeSRH
// but integrated over the sfc → 950 → 900 hPa layer (~0-1000 m AGL).
// Storm motion still estimated via 30R75 from the deeper-layer mean wind.
export function computeSRH01(sfcSpdKmh, sfcDir, w950Spd, w950Dir, w900Spd, w900Dir, w925Spd, w925Dir, w850Spd, w850Dir, w700Spd, w700Dir, w500Spd, w500Dir) {
  const sfc = windUV(sfcSpdKmh, sfcDir);
  const w950 = windUV(w950Spd, w950Dir);
  const w900 = windUV(w900Spd, w900Dir);
  const w925 = windUV(w925Spd, w925Dir);
  const w850 = windUV(w850Spd, w850Dir);
  const w700 = windUV(w700Spd, w700Dir);
  const w500 = windUV(w500Spd, w500Dir);
  if (!sfc || !w950 || !w900 || !w925 || !w850 || !w700 || !w500) return null;

  // Storm motion: 30R75 on mean 0-6km wind (same as SRH 0-3 km).
  const all = [sfc, w925, w850, w700, w500];
  const meanU = all.reduce((s, l) => s + l.u, 0) / all.length;
  const meanV = all.reduce((s, l) => s + l.v, 0) / all.length;
  const theta = (30 * Math.PI) / 180;
  const cos = Math.cos(theta), sin = Math.sin(theta);
  const cu = 0.75 * (meanU * cos + meanV * sin);
  const cv = 0.75 * (-meanU * sin + meanV * cos);

  // SRH integrated only over the 0-1 km layer: sfc → 950 (~540m) → 900 (~990m).
  const layers = [sfc, w950, w900];
  let srh = 0;
  for (let i = 0; i < layers.length - 1; i++) {
    const du = layers[i + 1].u - layers[i].u;
    const dv = layers[i + 1].v - layers[i].v;
    srh += du * (layers[i].v - cv) - dv * (layers[i].u - cu);
  }
  return srh;
}

// Tornadic risk (rotation-based, 0-1 km AGL). Requires both surface
// rotation (SRH 0-1km) AND instability (CAPE/LI) — pure shear without
// convection produces nothing. Returns FAIBLE when instability is absent
// even with high SRH.
//
// Thresholds calibrated for SRH 0-1 km (stricter than 0-3 km because surface
// rotation is what actually drops a tornado):
//   <50  weak/no rotation
//   50-100 marginal mesocyclone (EF0 possible)
//   100-150 EF0-EF1 likely if firing
//   150-250 EF2+ possible (significant tornado threshold)
//   >=250 significant tornado probable
export function tornadicRisk(srh01, cape, lifted) {
  if (srh01 == null) return RISK.FAIBLE;
  const c = cape ?? 0;
  const li = lifted == null ? 99 : lifted;
  const hasInstab = c >= 1500 || li <= -5;
  if (!hasInstab) return RISK.FAIBLE;
  const abs = Math.abs(srh01);
  if (abs >= 250) return RISK.EXTREME;
  if (abs >= 150) return RISK.ELEVE;
  if (abs >= 100) return RISK.MODERE;
  if (abs >= 50)  return RISK.FAIBLE; // detectable but pas alerte
  return RISK.FAIBLE;
}

// Deep-layer wind shear (sfc → 500 hPa) in knots, computed from the wind
// vector difference. Returns null when either level is missing.
//   <25 kt: pulse storms (short-lived)
//   25-40 kt: multicells (organized)
//   >=40 kt: supercells possible
export function computeShearKt(sfcSpdKmh, sfcDir, w500SpdKmh, w500Dir) {
  if (sfcSpdKmh == null || sfcDir == null || w500SpdKmh == null || w500Dir == null) return null;
  const r = (d) => (d * Math.PI) / 180;
  // Meteorological convention: dir = direction wind is FROM, so the wind
  // vector points to (dir + 180). u = -spd*sin(dir), v = -spd*cos(dir).
  const uSfc = -sfcSpdKmh * Math.sin(r(sfcDir));
  const vSfc = -sfcSpdKmh * Math.cos(r(sfcDir));
  const u500 = -w500SpdKmh * Math.sin(r(w500Dir));
  const v500 = -w500SpdKmh * Math.cos(r(w500Dir));
  const shearKmh = Math.hypot(u500 - uSfc, v500 - vSfc);
  return shearKmh * 0.539957; // km/h → kt
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

// Combined hourly/daily storm risk: worst of WMO code, CAPE, and Lifted Index.
// Keraunos-style: instability is described by multiple parameters, not just
// CAPE (which can be high without convection actually firing). Backward
// compatible — old callers can still pass just (code, cape).
export function stormRisk(code, cape, lifted) {
  return maxRisk(wmoOrageRisk(code), maxRisk(capeRisk(cape ?? 0), liftedRisk(lifted)));
}

// Severe (violent) storm risk — Keraunos convective composite.
//
// Real severe storms require BOTH instability (energy) AND organization
// (vertical wind shear). High CAPE alone gives short pulse storms, not
// hail/wind/tornado producers. We score each ingredient 0-2 and combine:
//   instab = CAPE ≥ 2500 OR LI ≤ −7  → 2
//          | CAPE ≥ 1500 OR LI ≤ −5  → 1
//   org    = shear ≥ 40 kt → 2 (supercell)
//          | shear ≥ 25 kt → 1 (multicell)
// Then: violent risk requires shear AND instability; pure CAPE-only stays
// "Faible" because pulse storms aren't classified as violent.
//
// WMO hail codes (96 = small hail, 99 = heavy hail) still set a floor so we
// don't underrate when the model explicitly forecasts grêle.
export function severeStormRisk(code, cape, lifted, shearKt) {
  let base = RISK.FAIBLE;
  if (code === 99) base = RISK.ELEVE;
  else if (code === 96) base = RISK.MODERE;

  const c = cape ?? 0;
  const li = lifted == null ? 99 : lifted; // 99 = stable
  const sh = shearKt ?? 0;

  const instab = (c >= 2500 || li <= -7) ? 2 : (c >= 1500 || li <= -5) ? 1 : 0;
  const org    = sh >= 40 ? 2 : sh >= 25 ? 1 : 0;

  let composite = RISK.FAIBLE;
  if (instab >= 2 && org >= 2) composite = RISK.ELEVE;       // supercell potential
  else if (instab >= 2 && org >= 1) composite = RISK.MODERE; // organized multicell
  else if (instab >= 1 && org >= 2) composite = RISK.MODERE; // marginal but shear-driven
  // instab without org = pulse storm = pas violent
  // org without instab = stable, no convection = pas violent

  return maxRisk(base, composite);
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
