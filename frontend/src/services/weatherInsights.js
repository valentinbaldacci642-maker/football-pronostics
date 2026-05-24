// Smart weather insights — PURE functions (no I/O, no React).
//
// Input: the data already fetched by the météo screens
//   { forecast, airQuality, marine }  (shapes from services/meteo.js)
// Output: { conditions: [...], summary: "texte foufous" }
//
// `conditions` = detected smart alerts (gel, fenêtre sans pluie, chaleur/froid,
// UV, pollen, air) each: { id, severity, emoji, title, detail }.
// `summary`    = a short, fun French recap of the next ~5 days.
//
// Being pure makes this instant, offline, and unit-testable with fixtures.

// ── Seuils (presets) ─────────────────────────────────────────────────────────
const FROST_C = 0; // gel : T° mini ≤ 0
const HEAT_C = 32; // forte chaleur : T° maxi ≥ 32
const COLD_MAX_C = 0; // grand froid : journée sans dégel (maxi ≤ 0)
const UV_HIGH = 7; // UV élevé
const AQI_BAD = 60; // air dégradé : European AQI > 60
const POLLEN_HIGH = 30; // pollen élevé (grains/m³, bande CAMS "élevé")
const RAIN_MM = 0.2; // une heure compte comme "pluvieuse" au-delà
const RAIN_PROB = 50; // …ou si la proba de pluie atteint ce seuil
const DRY_RUN_H = 2; // accalmie = au moins N heures sèches d'affilée

const SEVERITY_RANK = { high: 3, warn: 2, info: 1 };

const POLLEN_LABELS = [
  { key: 'grass_pollen', label: 'graminées' },
  { key: 'ragweed_pollen', label: 'ambroisie' },
  { key: 'birch_pollen', label: 'bouleau' },
  { key: 'olive_pollen', label: 'olivier' },
  { key: 'alder_pollen', label: 'aulne' },
  { key: 'mugwort_pollen', label: 'armoise' },
];

const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

function dayLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const a = new Date(); a.setHours(0, 0, 0, 0);
  const b = new Date(d); b.setHours(0, 0, 0, 0);
  const diff = Math.round((b - a) / 86400000);
  if (diff <= 0) return "aujourd'hui";
  if (diff === 1) return 'demain';
  return DAYS[d.getDay()];
}

function hourLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `vers ${d.getHours()}h`;
}

// WMO weather code → coarse sky category.
function skyCategory(code) {
  if (code == null) return 'cloud';
  if (code >= 95) return 'storm';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if (code <= 1) return 'sun';
  return 'cloud'; // 2,3,45,48
}

// First hourly index at or after the current hour.
function nowIndex(times) {
  if (!Array.isArray(times)) return 0;
  const now = Date.now() - 3600000; // tolerate the in-progress hour
  const i = times.findIndex((t) => new Date(t).getTime() >= now);
  return i < 0 ? 0 : i;
}

// ── Détecteurs ───────────────────────────────────────────────────────────────
function detectFrost(h, start) {
  const temps = h.temperature_2m || [];
  let min = Infinity; let at = -1;
  for (let i = start; i < Math.min(start + 24, temps.length); i++) {
    if (temps[i] != null && temps[i] < min) { min = temps[i]; at = i; }
  }
  if (at < 0 || min > FROST_C) return null;
  return {
    id: 'gel', severity: min <= -3 ? 'high' : 'warn', emoji: '🧊',
    title: 'Gel', detail: `${Math.round(min)}° ${hourLabel(h.time?.[at])}`.trim(),
  };
}

function detectDryWindow(h, start) {
  const prec = h.precipitation || [];
  const prob = h.precipitation_probability || [];
  const wet = (i) => (prec[i] ?? 0) >= RAIN_MM || (prob[i] ?? 0) >= RAIN_PROB;
  // Utile seulement s'il pleut maintenant : on annonce la prochaine accalmie.
  if (!wet(start)) return null;
  const end = Math.min(start + 18, prec.length);
  for (let i = start + 1; i < end; i++) {
    let dry = true;
    for (let j = i; j < Math.min(i + DRY_RUN_H, end); j++) { if (wet(j)) { dry = false; break; } }
    if (dry) {
      return {
        id: 'accalmie', severity: 'info', emoji: '🌂',
        title: 'Fenêtre sans pluie', detail: `accalmie ${hourLabel(h.time?.[i])}`.trim(),
      };
    }
  }
  return null;
}

function detectHeatCold(d) {
  const max = d.temperature_2m_max || [];
  const time = d.time || [];
  for (let i = 0; i < Math.min(2, max.length); i++) {
    if (max[i] != null && max[i] >= HEAT_C) {
      return {
        id: 'chaleur', severity: max[i] >= 35 ? 'high' : 'warn', emoji: '🥵',
        title: 'Forte chaleur', detail: `${Math.round(max[i])}° ${dayLabel(time[i])}`.trim(),
      };
    }
  }
  for (let i = 0; i < Math.min(2, max.length); i++) {
    if (max[i] != null && max[i] <= COLD_MAX_C) {
      return {
        id: 'froid', severity: 'warn', emoji: '🥶',
        title: 'Grand froid', detail: `max ${Math.round(max[i])}° ${dayLabel(time[i])}`.trim(),
      };
    }
  }
  return null;
}

function detectUV(d) {
  const uv = d.uv_index_max || [];
  const time = d.time || [];
  for (let i = 0; i < Math.min(2, uv.length); i++) {
    if (uv[i] != null && uv[i] >= UV_HIGH) {
      return {
        id: 'uv', severity: uv[i] >= 8 ? 'high' : 'warn', emoji: '🧴',
        title: 'UV élevé', detail: `indice ${Math.round(uv[i])} ${dayLabel(time[i])}`.trim(),
      };
    }
  }
  return null;
}

function detectPollen(c) {
  let worst = null; let worstV = 0;
  for (const p of POLLEN_LABELS) {
    const v = c[p.key];
    if (v != null && v > worstV) { worstV = v; worst = p; }
  }
  if (!worst || worstV < POLLEN_HIGH) return null;
  return {
    id: 'pollen', severity: worstV >= 80 ? 'high' : 'warn', emoji: '🤧',
    title: 'Pollens élevés', detail: `${worst.label} fort`,
  };
}

function detectAir(c) {
  const aqi = c.european_aqi;
  if (aqi == null || aqi <= AQI_BAD) return null;
  return {
    id: 'air', severity: aqi > 80 ? 'high' : 'warn', emoji: '😷',
    title: 'Air dégradé', detail: `indice ${Math.round(aqi)}`,
  };
}

// ── Conseil court associé à une condition (ton foufous) ──────────────────────
const ADVICE = {
  gel: '🧊 Pense à gratter le pare-brise.',
  accalmie: null, // déjà explicite dans le détail
  chaleur: '🥵 Hydrate-toi bien.',
  froid: '🥶 Couvre-toi à fond.',
  uv: '🧴 Crème solaire obligatoire.',
  pollen: '🤧 Mouchoirs si t\'es allergique.',
  air: '😷 Air pas top, évite le sport dehors.',
};

// ── Résumé foufous ───────────────────────────────────────────────────────────
function buildSummary(forecast, conditions) {
  const d = forecast?.daily;
  if (!d || !Array.isArray(d.weather_code) || d.weather_code.length === 0) return '';
  const codes = d.weather_code;
  const max = d.temperature_2m_max || [];
  const time = d.time || [];
  const N = Math.min(5, codes.length);
  const cats = [];
  for (let i = 0; i < N; i++) cats.push(skyCategory(codes[i]));

  const tToday = max[0] != null ? `${Math.round(max[0])}°` : '';
  const parts = [];

  // 1) Aujourd'hui
  switch (cats[0]) {
    case 'sun': parts.push(`☀️ Grand beau aujourd'hui${tToday ? ` (${tToday})` : ''}, profites-en les copains !`); break;
    case 'cloud': parts.push(`⛅ Ciel partagé aujourd'hui${tToday ? ` (${tToday})` : ''}.`); break;
    case 'rain': parts.push(`🌧️ Sors le parapluie, ça mouille aujourd'hui${tToday ? ` (${tToday})` : ''}.`); break;
    case 'storm': parts.push('⛈️ Attention, les orages débarquent aujourd\'hui !'); break;
    case 'snow': parts.push('❄️ Ça blanchit dehors aujourd\'hui !'); break;
    default: parts.push(`Météo du jour${tToday ? ` : ${tToday}` : ''}.`);
  }

  // 2) Premier changement notable (pluie / orage / retour du soleil)
  let firstBad = -1;
  for (let i = 1; i < N; i++) { if (cats[i] === 'rain' || cats[i] === 'storm') { firstBad = i; break; } }
  if (firstBad > 0) {
    const lbl = dayLabel(time[firstBad]);
    parts.push(cats[firstBad] === 'storm' ? `Orages ${lbl} ⛈️.` : `Pluie ${lbl} 🌧️.`);
  } else if (cats[0] === 'rain' || cats[0] === 'storm') {
    let firstGood = -1;
    for (let i = 1; i < N; i++) { if (cats[i] === 'sun' || cats[i] === 'cloud') { firstGood = i; break; } }
    if (firstGood > 0) parts.push(`Ça se dégage ${dayLabel(time[firstGood])} 🌤️.`);
  } else {
    parts.push('Et ça tient les prochains jours, le kiff. 😎');
  }

  // 3) Conseil lié à l'alerte la plus forte
  const top = conditions[0];
  if (top && ADVICE[top.id]) parts.push(ADVICE[top.id]);

  return parts.join(' ');
}

/**
 * Analyse les données météo déjà récupérées et renvoie alertes + résumé.
 * Tolérant aux données manquantes (renvoie ce qu'il peut).
 */
export function analyzeWeather({ forecast, airQuality } = {}) {
  const conditions = [];
  const push = (c) => { if (c) conditions.push(c); };

  if (forecast?.hourly?.time) {
    const h = forecast.hourly;
    const start = nowIndex(h.time);
    push(detectFrost(h, start));
    push(detectDryWindow(h, start));
  }
  if (forecast?.daily?.time) {
    push(detectHeatCold(forecast.daily));
    push(detectUV(forecast.daily));
  }
  if (airQuality?.current) {
    push(detectPollen(airQuality.current));
    push(detectAir(airQuality.current));
  }

  conditions.sort((a, b) => (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0));
  const summary = buildSummary(forecast, conditions);
  return { conditions, summary };
}

// Couleur d'accent par sévérité (pour l'UI).
export function severityColor(severity) {
  if (severity === 'high') return '#ef4444';
  if (severity === 'warn') return '#f59e0b';
  return '#38bdf8';
}
