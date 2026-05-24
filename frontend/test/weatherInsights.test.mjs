// Tests for the smart weather insights engine.
// Run from frontend/:  esbuild --bundle then node (see package note), or:
//   node_modules/.bin/esbuild test/weatherInsights.test.mjs --bundle --platform=node --format=esm --outfile=test/_w.mjs && node test/_w.mjs

import assert from 'node:assert/strict';
import { analyzeWeather } from '../src/services/weatherInsights.js';

let failures = 0;
const check = (name, fn) => {
  try { fn(); console.log(`  ok  - ${name}`); }
  catch (e) { failures += 1; console.error(`  FAIL - ${name}\n        ${e.message}`); }
};
const has = (conds, id) => conds.some((c) => c.id === id);

// Build hourly time array of N hours starting at the current hour (local ISO).
function hours(n) {
  const out = [];
  const d = new Date(); d.setMinutes(0, 0, 0);
  for (let i = 0; i < n; i++) {
    const t = new Date(d.getTime() + i * 3600000);
    const p = (x) => String(x).padStart(2, '0');
    out.push(`${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}T${p(t.getHours())}:00`);
  }
  return out;
}
function days(n) {
  const out = [];
  const d = new Date(); d.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    const t = new Date(d.getTime() + i * 86400000);
    const p = (x) => String(x).padStart(2, '0');
    out.push(`${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`);
  }
  return out;
}
const fill = (n, v) => Array.from({ length: n }, () => v);

// ── Gel ──
check('détecte le gel (T° mini ≤ 0)', () => {
  const time = hours(24);
  const temps = fill(24, 5); temps[6] = -2;
  const { conditions } = analyzeWeather({ forecast: { hourly: { time, temperature_2m: temps } } });
  assert.ok(has(conditions, 'gel'), 'gel attendu');
});
check('pas de gel si doux', () => {
  const time = hours(24);
  const { conditions } = analyzeWeather({ forecast: { hourly: { time, temperature_2m: fill(24, 8) } } });
  assert.ok(!has(conditions, 'gel'));
});

// ── Forte chaleur ──
check('détecte la forte chaleur (≥ 32°)', () => {
  const time = days(3);
  const { conditions } = analyzeWeather({ forecast: { daily: { time, temperature_2m_max: [34, 30, 28], weather_code: [0, 0, 0] } } });
  assert.ok(has(conditions, 'chaleur'));
});

// ── UV ──
check('détecte UV élevé (≥ 7)', () => {
  const time = days(2);
  const { conditions } = analyzeWeather({ forecast: { daily: { time, uv_index_max: [9, 5], weather_code: [0, 0] } } });
  const uv = conditions.find((c) => c.id === 'uv');
  assert.ok(uv && uv.severity === 'high');
});

// ── Fenêtre sans pluie ──
check('détecte une accalmie quand il pleut puis ça s\'arrête', () => {
  const time = hours(12);
  const prec = fill(12, 0); prec[0] = 1.2; prec[1] = 0.8; // pluie maintenant
  const { conditions } = analyzeWeather({ forecast: { hourly: { time, precipitation: prec, temperature_2m: fill(12, 12) } } });
  assert.ok(has(conditions, 'accalmie'), 'accalmie attendue');
});
check('pas d\'accalmie s\'il fait sec maintenant', () => {
  const time = hours(12);
  const { conditions } = analyzeWeather({ forecast: { hourly: { time, precipitation: fill(12, 0), temperature_2m: fill(12, 12) } } });
  assert.ok(!has(conditions, 'accalmie'));
});

// ── Pollen / Air ──
check('détecte pollen élevé', () => {
  const { conditions } = analyzeWeather({ airQuality: { current: { grass_pollen: 95 } } });
  const p = conditions.find((c) => c.id === 'pollen');
  assert.ok(p && p.severity === 'high' && /graminées/.test(p.detail));
});
check('détecte air dégradé (AQI > 60)', () => {
  const { conditions } = analyzeWeather({ airQuality: { current: { european_aqi: 85 } } });
  assert.ok(has(conditions, 'air'));
});

// ── Résumé ──
check('résumé : beau aujourd\'hui + pluie plus tard', () => {
  const time = days(5);
  const { summary } = analyzeWeather({ forecast: { daily: { time, weather_code: [0, 1, 61, 3, 0], temperature_2m_max: [26, 25, 18, 20, 24] } } });
  assert.ok(/Grand beau/.test(summary), `résumé inattendu: ${summary}`);
  assert.ok(/Pluie/.test(summary), `pluie absente: ${summary}`);
});
check('résumé : tout sec → message "ça tient"', () => {
  const time = days(5);
  const { summary } = analyzeWeather({ forecast: { daily: { time, weather_code: [0, 0, 1, 2, 0], temperature_2m_max: [24, 25, 26, 25, 24] } } });
  assert.ok(/tient/.test(summary), `résumé inattendu: ${summary}`);
});

// ── Tri par sévérité ──
check('les conditions high passent avant warn', () => {
  const time = days(2);
  const { conditions } = analyzeWeather({
    forecast: { daily: { time, temperature_2m_max: [36, 30], uv_index_max: [7, 5], weather_code: [0, 0] } },
  });
  assert.ok(conditions.length >= 2 && conditions[0].severity === 'high');
});

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
