// Earthquake data for the MimiSéisme section. USGS + EMSC, fetched client-side
// (both send permissive CORS headers). Pure-ish: one network call set, no state.

const USGS_DAY = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';
const EMSC = 'https://www.seismicportal.eu/fdsnws/event/1/query?limit=300&format=json';

function fromUSGS(json) {
  const out = [];
  for (const f of (json?.features || [])) {
    const c = f.geometry?.coordinates || [];
    const p = f.properties || {};
    if (p.mag == null) continue;
    out.push({
      id: `usgs_${f.id}`,
      mag: p.mag,
      place: p.place || 'Lieu inconnu',
      time: p.time,
      depth: c[2],
      lat: c[1],
      lon: c[0],
      tsunami: p.tsunami === 1,
      source: 'USGS',
      url: p.url || null,
    });
  }
  return out;
}

function fromEMSC(json) {
  const out = [];
  for (const f of (json?.features || [])) {
    const c = f.geometry?.coordinates || [];
    const p = f.properties || {};
    if (p.mag == null) continue;
    out.push({
      id: `emsc_${f.id || p.unid || `${p.time}_${p.mag}`}`,
      mag: p.mag,
      place: p.flynn_region || 'Lieu inconnu',
      time: new Date(p.time).getTime(),
      depth: c[2],
      lat: c[1],
      lon: c[0],
      tsunami: false,
      source: 'EMSC',
      url: p.url || null,
    });
  }
  return out;
}

// Drop near-duplicate events reported by both feeds (same ~time & ~location).
function dedupe(list) {
  const kept = [];
  for (const q of list) {
    const dup = kept.find((k) => Math.abs(k.time - q.time) < 60000
      && Math.abs(k.lat - q.lat) < 0.5 && Math.abs(k.lon - q.lon) < 0.5);
    if (!dup) kept.push(q);
  }
  return kept;
}

export async function getEarthquakes() {
  const [usgs, emsc] = await Promise.allSettled([
    fetch(USGS_DAY).then((r) => r.json()),
    fetch(EMSC).then((r) => r.json()),
  ]);
  let all = [];
  if (usgs.status === 'fulfilled') all = all.concat(fromUSGS(usgs.value));
  if (emsc.status === 'fulfilled') all = all.concat(fromEMSC(emsc.value));
  all.sort((a, b) => b.time - a.time);
  return dedupe(all);
}

// Colour by magnitude (matches the notif/icon scale).
export function magColor(m) {
  if (m >= 6) return '#ef4444';   // rouge
  if (m >= 4.5) return '#f97316'; // orange
  if (m >= 3) return '#eab308';   // jaune
  return '#22c55e';               // vert
}

export function magLabel(m) {
  if (m >= 6) return 'Majeur';
  if (m >= 4.5) return 'Modéré';
  if (m >= 3) return 'Léger';
  return 'Mineur';
}

// "il y a 12 min" / "il y a 3 h"
export function timeAgo(ts) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `il y a ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}
