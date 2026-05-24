import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, RefreshCw, Wind, Droplets, Sun, Thermometer, CloudRain, Zap, Snowflake, Gauge, Leaf, Waves, Bell, BellRing, ShieldAlert } from 'lucide-react';
import { ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  getForecast, getAirQuality, getMarine, wmo, windRisk, rainRisk, uvRisk, stormRisk, severeStormRisk, maxRisk,
  dirToCompass, RISK, windyUrl, blitzortungUrl, tempColor, aqiLevel, pollenLevel, POLLENS,
  isAlertCity, toggleAlertCity,
} from '../../services/meteo';
import { weatherApi } from '../../services/api';
import { syncWeatherCitiesToBackend } from '../../services/pushNotifications';
import { InfoBadge, orageText, violentText } from '../../components/meteo/RiskUI';
import MapEmbed from '../../components/meteo/MapEmbed';
import WeatherInsights from '../../components/meteo/WeatherInsights';

const DAYS_FR = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

// Meteociel HD radars (fixed France-wide views — no per-city centring available).
const METEOCIEL_RAIN_HD = 'https://www.meteociel.fr/observations-meteo/radarzoom.php?x=8229.39&y=8647.89&ech=11&zoom=3';
const METEOCIEL_SNOW = 'https://www.meteociel.fr/observations-meteo/radarzoom.php?&x=7709.94&y=7625.72&zoom=2.1&ech=0&snow=1';
const METEOCIEL_FOUDRE = 'https://www.meteociel.fr/observations-meteo/foudre-direct.php';

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
}

// Unit helpers — display only; colour/risk logic keeps using the raw °C / km/h values.
const MPH_PER_KMH = 0.621371;
function fmtTemp(c, unit) {
  if (c == null || Number.isNaN(c)) return '–';
  return unit === 'K' ? `${Math.round(c + 273.15)} K` : `${Math.round(c)}°`;
}
function fmtWind(kmh, unit) {
  return Math.round((unit === 'mph' ? (kmh || 0) * MPH_PER_KMH : (kmh || 0)));
}
function windUnitLabel(unit) { return unit === 'mph' ? 'mph' : 'km/h'; }

function UnitToggle({ options, value, onChange }) {
  return (
    <div className="inline-flex rounded-lg overflow-hidden backdrop-blur-md" style={{ border: '1px solid rgba(255,255,255,0.14)' }}>
      {options.map((o) => {
        const active = value === o.v;
        return (
          <button key={o.v} onClick={() => onChange(o.v)}
            className="px-2.5 py-1 text-xs font-heading font-bold transition-colors"
            style={active ? { background: 'rgba(56,189,248,0.25)', color: '#7dd3fc' } : { color: 'rgba(255,255,255,0.5)' }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Atmosphere that reacts to the current sky — committing to a premium,
// weather-driven look instead of a flat background.
function skyTheme(code, isDay) {
  const night = isDay === 0;
  if (code >= 95) return { bg: 'radial-gradient(120% 80% at 50% 0%, #2b2a6b 0%, #14132e 45%, #0a0a18 100%)', glow: 'rgba(168,85,247,0.30)' };
  if (code >= 71 && code <= 86) return { bg: 'radial-gradient(120% 80% at 50% 0%, #2a3a52 0%, #131e2e 50%, #080d16 100%)', glow: 'rgba(186,230,253,0.22)' };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { bg: 'radial-gradient(120% 80% at 50% 0%, #1d3450 0%, #0e1c30 50%, #070e1a 100%)', glow: 'rgba(56,189,248,0.24)' };
  if (code === 45 || code === 48) return { bg: 'radial-gradient(120% 80% at 50% 0%, #29313d 0%, #141a23 55%, #0a0e14 100%)', glow: 'rgba(148,163,184,0.20)' };
  if (code === 3) return { bg: 'radial-gradient(120% 80% at 50% 0%, #233246 0%, #121b28 55%, #080d15 100%)', glow: 'rgba(148,163,184,0.18)' };
  if (code === 1 || code === 2) {
    return night
      ? { bg: 'radial-gradient(120% 80% at 50% 0%, #141c3a 0%, #0a1022 55%, #05070f 100%)', glow: 'rgba(129,140,248,0.26)' }
      : { bg: 'radial-gradient(120% 80% at 50% 0%, #1b4063 0%, #0e2238 55%, #07111d 100%)', glow: 'rgba(251,191,36,0.20)' };
  }
  return night
    ? { bg: 'radial-gradient(120% 80% at 50% 0%, #0f1a40 0%, #080f24 55%, #04060f 100%)', glow: 'rgba(129,140,248,0.30)' }
    : { bg: 'radial-gradient(120% 80% at 50% 0%, #0f4a7a 0%, #0a2845 50%, #06121f 100%)', glow: 'rgba(251,191,36,0.28)' };
}

function buildDays(data) {
  const daily = data.daily || {};
  const hourly = data.hourly || {};
  const hoursByDate = {};
  (hourly.time || []).forEach((t, i) => {
    const date = t.slice(0, 10);
    (hoursByDate[date] = hoursByDate[date] || []).push({
      hour: new Date(t).getHours(),
      tempC: Math.round(hourly.temperature_2m?.[i]),
      feelsLikeC: Math.round(hourly.apparent_temperature?.[i]),
      windKmh: Math.round(hourly.wind_speed_10m?.[i] ?? 0),
      gustKmh: Math.round(hourly.wind_gusts_10m?.[i] ?? 0),
      windDir: hourly.wind_direction_10m?.[i],
      precipMm: hourly.precipitation?.[i] ?? 0,
      precipProb: hourly.precipitation_probability?.[i] ?? 0,
      uvIndex: Math.round(hourly.uv_index?.[i] ?? 0),
      cape: hourly.cape?.[i] ?? 0,
      wmoCode: hourly.weather_code?.[i],
    });
  });
  return (daily.time || []).map((date, i) => ({
    date,
    tempMin: Math.round(daily.temperature_2m_min?.[i]),
    tempMax: Math.round(daily.temperature_2m_max?.[i]),
    desc: wmo(daily.weather_code?.[i]).label,
    emoji: wmo(daily.weather_code?.[i]).emoji,
    code: daily.weather_code?.[i],
    precipMm: daily.precipitation_sum?.[i] ?? 0,
    precipProb: daily.precipitation_probability_max?.[i] ?? 0,
    windKmh: Math.round(daily.wind_speed_10m_max?.[i] ?? 0),
    gustKmh: Math.round(daily.wind_gusts_10m_max?.[i] ?? 0),
    windDir: daily.wind_direction_10m_dominant?.[i],
    uvMax: Math.round(daily.uv_index_max?.[i] ?? 0),
    snowfallCm: daily.snowfall_sum?.[i] ?? 0,
    hours: hoursByDate[date] || [],
  }));
}

function HourRow({ h, tempUnit, windUnit }) {
  const gust = windRisk(h.gustKmh);
  const precip = rainRisk(h.precipMm);
  const orage = stormRisk(h.wmoCode, h.cape);
  const violent = severeStormRisk(h.wmoCode);
  return (
    <div className="flex items-center gap-2 min-h-[46px] py-1.5 border-t border-white/[0.06]">
      <span className="text-xs font-mono w-8 flex-shrink-0 text-white/40">{String(h.hour).padStart(2, '0')}h</span>
      <span className="text-base w-6 flex-shrink-0 text-center">{wmo(h.wmoCode).emoji}</span>
      <div className="w-14 flex-shrink-0 leading-tight">
        <span className="text-[13px] font-bold" style={{ color: tempColor(h.tempC) }}>{fmtTemp(h.tempC, tempUnit)}</span>
        {h.feelsLikeC !== h.tempC && <span className="block text-[10px] text-white/35">{fmtTemp(h.feelsLikeC, tempUnit)}</span>}
      </div>
      <div className="flex-1 flex flex-wrap gap-1">
        <InfoBadge icon="💨" risk={gust} text={`${fmtWind(h.windKmh, windUnit)} (↑${fmtWind(h.gustKmh, windUnit)}) ${windUnitLabel(windUnit)} ${dirToCompass(h.windDir)}`} />
        <InfoBadge icon="🌧️" risk={precip} text={`${h.precipMm.toFixed(1)}mm · ${h.precipProb}%`} />
        {h.uvIndex >= 3 && <InfoBadge icon="☀️" risk={uvRisk(h.uvIndex)} text={`UV ${h.uvIndex}`} />}
        <InfoBadge icon="⛈️" risk={orage} text={orageText(orage)} />
        <InfoBadge icon="🌩️" risk={violent} text={violentText(violent)} />
      </div>
    </div>
  );
}

function dayRisks(day) {
  const maxHourPrecip = day.hours.length ? Math.max(...day.hours.map((h) => h.precipMm)) : day.precipMm;
  const windR = windRisk(day.gustKmh);
  const precipR = rainRisk(maxHourPrecip);
  const orageR = day.hours.length
    ? day.hours.reduce((a, h) => maxRisk(a, stormRisk(h.wmoCode, h.cape)), RISK.FAIBLE)
    : stormRisk(day.code, 0);
  const violentR = day.hours.length
    ? day.hours.reduce((a, h) => maxRisk(a, severeStormRisk(h.wmoCode)), RISK.FAIBLE)
    : severeStormRisk(day.code);
  const top = [windR, precipR, orageR, violentR].reduce((a, b) => maxRisk(a, b), RISK.FAIBLE);
  return { windR, precipR, orageR, violentR, top };
}

function Pill({ risk, children }) {
  return (
    <span className="inline-block rounded-md px-2 py-0.5 text-[11px] font-bold whitespace-nowrap"
      style={{ backgroundColor: risk.bgHex, color: risk.color, border: `1px solid ${risk.color}55` }}>
      {children}
    </span>
  );
}

function ForecastRow({ day, isToday, tempUnit, windUnit }) {
  const [expanded, setExpanded] = useState(false);
  const { windR, precipR, orageR, violentR, top } = dayRisks(day);
  const showViolent = violentR.key !== 'FAIBLE';
  return (
    <>
      <tr onClick={() => setExpanded((e) => !e)} className="cursor-pointer border-t border-white/[0.06] hover:bg-white/[0.04] transition-colors align-middle">
        <td className="pl-2 pr-1 sm:pl-3 sm:pr-2 py-2.5 relative whitespace-nowrap">
          <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full" style={{ background: top.color, opacity: 0.85 }} />
          <span className="font-heading font-bold capitalize text-[13px] sm:text-sm" style={{ color: isToday ? '#7dd3fc' : '#e2e8f0' }}>
            {isToday ? (<><span className="sm:hidden">Auj.</span><span className="hidden sm:inline">Aujourd'hui</span></>) : fmtDate(day.date)}
          </span>
        </td>
        <td className="px-1 sm:px-2 text-center text-base sm:text-lg" title={day.desc}>{day.emoji}</td>
        <td className="px-1 sm:px-2 text-right whitespace-nowrap">
          <span className="font-display text-sm sm:text-base" style={{ color: tempColor(day.tempMax) }}>{fmtTemp(day.tempMax, tempUnit)}</span>
          <span className="text-[11px] sm:text-xs ml-0.5 sm:ml-1" style={{ color: tempColor(day.tempMin), opacity: 0.85 }}>{fmtTemp(day.tempMin, tempUnit)}</span>
        </td>
        <td className="px-1 sm:px-2 text-right whitespace-nowrap">
          <span className="font-semibold text-[13px] sm:text-sm" style={{ color: windR.color }}>{fmtWind(day.windKmh, windUnit)}</span>
          <span className="text-white/40 text-[11px] sm:text-xs"> ↑{fmtWind(day.gustKmh, windUnit)}</span>
          <span className="hidden sm:inline text-white/35 text-[11px] ml-1">{windUnitLabel(windUnit)} {dirToCompass(day.windDir)}</span>
        </td>
        <td className="px-1 sm:px-2 text-right whitespace-nowrap">
          <span className="font-semibold text-[13px] sm:text-sm" style={{ color: precipR.color }}>{day.precipProb}%</span>
          <span className="text-white/45 text-[10px] sm:text-xs ml-0.5 sm:ml-1">{day.precipMm.toFixed(1)}mm</span>
        </td>
        <td className="px-1 sm:px-2 text-center">
          <span className="font-semibold text-[13px] sm:text-sm" style={{ color: uvRisk(day.uvMax).color }}>{day.uvMax}</span>
        </td>
        <td className="pr-2 pl-1 sm:pr-3 sm:pl-2 py-2.5 text-right">
          <Pill risk={orageR}>
            <span className="sm:hidden">{showViolent ? `⚡${violentR.label}` : (orageR.key === 'FAIBLE' ? '✓' : orageR.label)}</span>
            <span className="hidden sm:inline">{showViolent ? `⚡ ${violentR.label}` : orageText(orageR)}</span>
          </Pill>
        </td>
      </tr>
      {expanded && day.hours.length > 0 && (
        <tr>
          <td colSpan={7} className="px-3 pb-3 pt-1" style={{ background: 'rgba(0,0,0,0.18)' }}>
            {day.hours.map((h) => <HourRow key={h.hour} h={h} tempUnit={tempUnit} windUnit={windUnit} />)}
          </td>
        </tr>
      )}
    </>
  );
}

function ForecastTable({ days, tempUnit, windUnit }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden backdrop-blur-md"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }}
    >
      <div className="overflow-x-auto no-scrollbar">
      <table className="w-full min-w-[330px] border-collapse">
        <thead>
          <tr className="text-[9px] sm:text-[10px] uppercase tracking-wider text-white/40 font-heading">
            <th className="text-left pl-2 pr-1 sm:pl-3 sm:pr-2 py-2.5 font-bold">Jour</th>
            <th className="px-1 sm:px-2 py-2.5 font-bold">Ciel</th>
            <th className="px-1 sm:px-2 py-2.5 text-right font-bold">Temp.</th>
            <th className="px-1 sm:px-2 py-2.5 text-right font-bold">Vent {windUnitLabel(windUnit)}</th>
            <th className="px-1 sm:px-2 py-2.5 text-right font-bold">Pluie</th>
            <th className="px-1 sm:px-2 py-2.5 text-center font-bold">UV</th>
            <th className="pr-2 pl-1 sm:pr-3 sm:pl-2 py-2.5 text-right font-bold">Orage</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day, i) => <ForecastRow key={day.date} day={day} isToday={i === 0} tempUnit={tempUnit} windUnit={windUnit} />)}
        </tbody>
      </table>
      </div>
    </motion.div>
  );
}

function QuickStat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-4 py-3 backdrop-blur-md" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <Icon className="w-6 h-6 text-white/55 flex-shrink-0" />
      <div className="leading-none">
        <p className="text-xs uppercase tracking-wider text-white/45 font-heading">{label}</p>
        <p className="text-2xl font-heading font-bold text-white/90 mt-1">{value}</p>
      </div>
    </div>
  );
}

function BigTile({ icon: Icon, label, risk, value, sub }) {
  return (
    <div
      className="relative rounded-2xl p-4 overflow-hidden"
      style={{
        background: `linear-gradient(160deg, ${risk.color}26 0%, ${risk.color}0d 60%, rgba(255,255,255,0.02) 100%)`,
        border: `1px solid ${risk.color}55`,
        boxShadow: `0 10px 30px ${risk.color}1f`,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl" style={{ background: 'rgba(0,0,0,0.25)' }}>
          <Icon className="w-5 h-5" style={{ color: risk.color }} />
        </div>
        <span className="text-sm font-bold px-3 py-1 rounded-full text-white" style={{ background: risk.color }}>{risk.label}</span>
      </div>
      <p className="text-base font-heading font-semibold text-white/80">{label}</p>
      <p className="font-display text-2xl text-white mt-0.5">{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: risk.color }}>{sub}</p>}
    </div>
  );
}

const sectionLabel = 'text-[11px] font-heading font-bold tracking-[2px] text-white/45 mb-2.5';
const glassCard = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' };

// 48h meteogram: temperature line + precipitation bars.
function Meteogram({ data, tempUnit }) {
  const h = data?.hourly || {};
  const times = h.time || [];
  if (!times.length) return null;
  const now = Date.now();
  let start = times.findIndex((t) => new Date(t).getTime() >= now);
  if (start < 0) start = 0;
  start = Math.max(0, start - 1);
  const rows = [];
  for (let i = start; i < Math.min(start + 48, times.length); i++) {
    const d = new Date(times[i]);
    rows.push({
      label: d.getHours() === 0 ? `${d.getDate()}/${d.getMonth() + 1}` : `${d.getHours()}h`,
      temp: tempUnit === 'K' ? Math.round(h.temperature_2m[i] + 273.15) : Math.round(h.temperature_2m[i]),
      precip: +(h.precipitation?.[i] ?? 0).toFixed(1),
      prob: h.precipitation_probability?.[i] ?? 0,
    });
  }
  const unit = tempUnit === 'K' ? ' K' : '°';
  const renderTip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const r = payload[0].payload;
    return (
      <div style={{ background: '#0b1220', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '8px 10px', fontSize: 12 }}>
        <p style={{ color: '#94a3b8', marginBottom: 4 }}>{label}</p>
        <p style={{ color: '#f59e0b' }}>Température : <b>{r.temp}{unit}</b></p>
        <p style={{ color: '#38bdf8' }}>Pluie : <b>{r.prob}%</b> · {r.precip.toFixed(1)} mm</p>
      </div>
    );
  };
  return (
    <div className="rounded-2xl p-3 sm:p-4 backdrop-blur-md" style={glassCard}>
      <div className="flex items-center gap-4 mb-2 px-1 text-[11px] font-heading">
        <span className="flex items-center gap-1.5 text-amber-400"><span className="inline-block w-4 h-0.5 rounded-full" style={{ background: '#f59e0b' }} /> Température</span>
        <span className="flex items-center gap-1.5 text-sky-300"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: '#38bdf8' }} /> Probabilité de pluie (%)</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} interval={3} axisLine={false} tickLine={false} />
          <YAxis yAxisId="t" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} width={34} unit={unit} />
          <YAxis yAxisId="p" orientation="right" domain={[0, 100]} tick={{ fill: 'rgba(56,189,248,0.6)', fontSize: 10 }} axisLine={false} tickLine={false} width={30} unit="%" />
          <Tooltip content={renderTip} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
          <Bar yAxisId="p" dataKey="prob" fill="#38bdf8" opacity={0.5} radius={[3, 3, 0, 0]} maxBarSize={16} />
          <Line yAxisId="t" type="monotone" dataKey="temp" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

const POLLUTANTS = [
  { k: 'PM2.5', key: 'pm2_5', desc: 'Particules fines' },
  { k: 'PM10', key: 'pm10', desc: 'Particules' },
  { k: 'O₃', key: 'ozone', desc: 'Ozone' },
  { k: 'NO₂', key: 'nitrogen_dioxide', desc: 'Dioxyde d’azote' },
];

function AirPollen({ aq }) {
  const c = aq?.current;
  if (!c) return null;
  const lvl = aqiLevel(c.european_aqi);
  const pollens = POLLENS.map((p) => ({ ...p, v: c[p.key] })).filter((p) => p.v != null && p.v >= 1);
  return (
    <div>
      <p className={sectionLabel}>AIR & POLLEN</p>
      <div className="rounded-2xl p-4 backdrop-blur-md space-y-3.5" style={glassCard}>
        {lvl && (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,0,0,0.25)' }}>
                  <Gauge className="w-6 h-6" style={{ color: lvl.color }} />
                </div>
                <div className="leading-tight">
                  <p className="text-base font-heading font-semibold text-white/85">Qualité de l'air</p>
                  <p className="font-display text-3xl text-white">{Math.round(c.european_aqi)}<span className="text-sm text-white/45 ml-1.5">/ 100 · indice EU</span></p>
                </div>
              </div>
              <span className="text-base font-bold px-4 py-1.5 rounded-full text-white flex-shrink-0" style={{ background: lvl.color }}>{lvl.label}</span>
            </div>
            <p className="text-xs text-white/45 leading-relaxed">
              Indice européen de qualité de l'air : <span className="text-emerald-400">0–20 bon</span> · <span className="text-lime-400">20–40 moyen</span> · <span className="text-amber-400">40–60 dégradé</span> · <span className="text-red-400">60–80 mauvais</span> · <span className="text-purple-400">80+ très mauvais</span>.
            </p>
          </>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          {POLLUTANTS.map(({ k, key, desc }) => (
            <div key={k} className="text-center rounded-xl py-2.5 px-1" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <p className="text-xs uppercase tracking-wider text-white/55 font-heading font-bold">{k}</p>
              <p className="text-xl font-mono text-white/90 mt-1">{c[key] != null ? Math.round(c[key]) : '–'}</p>
              <p className="text-[10px] text-white/35 mt-0.5">µg/m³</p>
              <p className="text-[10px] text-white/40 mt-1 leading-tight">{desc}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-white/40 leading-relaxed">
          Concentrations en microgrammes par m³ d'air. <strong className="text-white/55">PM2.5/PM10</strong> = particules fines (plus c'est bas, mieux c'est) · <strong className="text-white/55">O₃</strong> ozone · <strong className="text-white/55">NO₂</strong> pollution auto.
        </p>
        {pollens.length > 0 && (
          <div className="pt-2 border-t border-white/[0.06]">
            <p className="text-xs uppercase tracking-wider text-white/50 font-heading font-bold mb-2 flex items-center gap-1.5"><Leaf className="w-3.5 h-3.5" /> Pollens · risque allergique</p>
            <div className="flex flex-wrap gap-1.5">
              {pollens.map((p) => {
                const r = pollenLevel(p.v);
                return (
                  <span key={p.key} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                    style={{ backgroundColor: r.bgHex, color: r.color, border: `1px solid ${r.color}55` }}>
                    <span>{p.icon}</span>{p.label} · {r.label}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MarineCard({ marine, tempUnit }) {
  const c = marine?.current;
  if (!c || (c.wave_height == null && c.sea_surface_temperature == null)) return null;
  const seaT = c.sea_surface_temperature;
  const seaTxt = seaT == null ? '–' : (tempUnit === 'K' ? `${Math.round(seaT + 273.15)} K` : `${Math.round(seaT)}°`);
  return (
    <div>
      <p className={sectionLabel}>MER</p>
      <div className="rounded-2xl p-4 backdrop-blur-md grid grid-cols-3 gap-2" style={glassCard}>
        <div className="flex flex-col items-center gap-1">
          <Thermometer className="w-4 h-4 text-cyan-300" />
          <span className="text-[10px] uppercase tracking-wider text-white/40 font-heading">Eau</span>
          <span className="font-display text-lg" style={{ color: tempColor(seaT) }}>{seaTxt}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Waves className="w-4 h-4 text-sky-300" />
          <span className="text-[10px] uppercase tracking-wider text-white/40 font-heading">Vagues</span>
          <span className="font-display text-lg text-white/90">{c.wave_height != null ? `${c.wave_height.toFixed(1)} m` : '–'}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <RefreshCw className="w-4 h-4 text-sky-300" />
          <span className="text-[10px] uppercase tracking-wider text-white/40 font-heading">Période</span>
          <span className="font-display text-lg text-white/90">{c.wave_period != null ? `${Math.round(c.wave_period)} s` : '–'}</span>
        </div>
      </div>
    </div>
  );
}

// Snow / ski — current snow depth on the ground + 14-day snowfall forecast.
// Only shown when there's snow on the ground or snowfall expected (mountains).
function SnowSki({ data, days, tempUnit }) {
  const h = data?.hourly || {};
  const times = h.time || [];
  const now = Date.now();
  let idx = times.findIndex((t) => new Date(t).getTime() >= now);
  if (idx < 0) idx = 0;
  const depthCm = Math.round((h.snow_depth?.[idx] ?? 0) * 100);
  const snowDays = (days || []).filter((d) => (d.snowfallCm ?? 0) >= 0.1);
  const total14 = snowDays.reduce((s, d) => s + d.snowfallCm, 0);
  if (depthCm <= 0 && total14 < 0.1) return null;
  const maxCm = Math.max(0.1, ...snowDays.map((d) => d.snowfallCm));
  return (
    <div>
      <p className={sectionLabel}>NEIGE & SKI</p>
      <div className="rounded-2xl p-4 backdrop-blur-md space-y-3" style={glassCard}>
        <div className="flex items-center justify-around text-center">
          <div className="flex flex-col items-center gap-1">
            <Snowflake className="w-5 h-5 text-cyan-200" />
            <span className="text-[10px] uppercase tracking-wider text-white/45 font-heading">Au sol</span>
            <span className="font-display text-2xl text-white">{depthCm}<span className="text-sm text-white/45 ml-1">cm</span></span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <CloudRain className="w-5 h-5 text-sky-300" />
            <span className="text-[10px] uppercase tracking-wider text-white/45 font-heading">Cumul 14 j</span>
            <span className="font-display text-2xl text-white">{total14.toFixed(0)}<span className="text-sm text-white/45 ml-1">cm</span></span>
          </div>
        </div>
        {snowDays.length > 0 && (
          <div className="pt-2 border-t border-white/[0.06] space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider text-white/45 font-heading">Chutes de neige prévues</p>
            {snowDays.map((d) => {
              const dd = new Date(d.date + 'T12:00:00');
              return (
                <div key={d.date} className="flex items-center gap-2 text-xs">
                  <span className="w-14 text-white/55 font-heading capitalize">{DAYS_FR[dd.getDay()]} {dd.getDate()}</span>
                  <div className="flex-1 h-2.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-cyan-300/70" style={{ width: `${Math.min(100, (d.snowfallCm / maxCm) * 100)}%` }} />
                  </div>
                  <span className="w-12 text-right text-cyan-200 font-mono">{d.snowfallCm.toFixed(1)} cm</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MeteoDashboard() {
  const [params] = useSearchParams();
  const lat = parseFloat(params.get('lat'));
  const lon = parseFloat(params.get('lon'));
  const name = params.get('name') || 'Ville';
  const admin = params.get('admin') || '';

  const [data, setData] = useState(null);
  const [aq, setAq] = useState(null);
  const [marine, setMarine] = useState(null);
  const [vigilance, setVigilance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tempUnit, setTempUnit] = useState(() => localStorage.getItem('meteo_tempUnit') || 'C');
  const [windUnit, setWindUnit] = useState(() => localStorage.getItem('meteo_windUnit') || 'kmh');
  const [mapSize, setMapSize] = useState(() => Number(localStorage.getItem('meteo_mapSize')) || 250);
  const [mapWidth, setMapWidth] = useState(() => Number(localStorage.getItem('meteo_mapWidth')) || 520);
  const [alertOn, setAlertOn] = useState(false);
  useEffect(() => { setAlertOn(isAlertCity(lat, lon)); }, [lat, lon]);
  const toggleAlert = () => {
    toggleAlertCity({ name: admin ? `${name} (${admin})` : name, lat, lon });
    setAlertOn((v) => !v);
    syncWeatherCitiesToBackend();
  };
  useEffect(() => { localStorage.setItem('meteo_tempUnit', tempUnit); }, [tempUnit]);
  useEffect(() => { localStorage.setItem('meteo_windUnit', windUnit); }, [windUnit]);
  useEffect(() => { localStorage.setItem('meteo_mapSize', String(mapSize)); }, [mapSize]);
  useEffect(() => { localStorage.setItem('meteo_mapWidth', String(mapWidth)); }, [mapWidth]);

  const load = () => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) { setError('Coordonnées invalides'); setLoading(false); return; }
    setLoading(true); setError(null);
    getForecast(lat, lon).then(setData).catch((e) => setError(e?.message || 'Erreur')).finally(() => setLoading(false));
    getAirQuality(lat, lon).then(setAq).catch(() => setAq(null));
    getMarine(lat, lon).then(setMarine).catch(() => setMarine(null));
    weatherApi.getVigilance(lat, lon).then((r) => setVigilance(r?.warnings || [])).catch(() => setVigilance([]));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [lat, lon]);

  const cur = data?.current || {};
  const days = data ? buildDays(data) : [];
  const today = days[0];
  const sky = skyTheme(cur.weather_code ?? 0, cur.is_day ?? 1);
  const { emoji, label } = wmo(cur.weather_code);

  const orageTile = today ? (today.hours.length ? today.hours.reduce((a, h) => maxRisk(a, stormRisk(h.wmoCode, h.cape)), RISK.FAIBLE) : stormRisk(today.code, 0)) : RISK.FAIBLE;
  const pluieTile = today ? rainRisk(today.hours.length ? Math.max(...today.hours.map((h) => h.precipMm)) : today.precipMm) : RISK.FAIBLE;
  const ventTile = today ? windRisk(today.gustKmh) : RISK.FAIBLE;
  const todayCape = today?.hours?.reduce((m, h) => Math.max(m, h.cape), 0) || 0;

  return (
    <div className="min-h-screen relative" style={{ background: sky.bg, paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}>
      {/* Atmospheric glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full blur-3xl" style={{ background: sky.glow }} />
      </div>

      <div className="relative w-full px-4 sm:px-5" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}>
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3">
          <Link to="/meteo" className="inline-flex items-center gap-2 text-sm text-white/55 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Recherche
          </Link>
          <div className="flex items-center gap-2">
            <UnitToggle value={tempUnit} onChange={setTempUnit} options={[{ v: 'C', label: '°C' }, { v: 'K', label: 'K' }]} />
            <UnitToggle value={windUnit} onChange={setWindUnit} options={[{ v: 'kmh', label: 'km/h' }, { v: 'mph', label: 'mph' }]} />
            <button onClick={toggleAlert} title={alertOn ? 'Alertes météo activées' : 'Activer les alertes pluie/orage'}
              className="p-2 rounded-full transition-colors"
              style={alertOn ? { color: '#7dd3fc', background: 'rgba(56,189,248,0.15)' } : { color: 'rgba(255,255,255,0.5)' }}>
              {alertOn ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
            </button>
            <button onClick={load} className="p-2 rounded-full text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
          </div>
        </div>

        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center text-center pt-8 pb-6">
          {loading ? (
            <div className="h-28 w-44 skeleton rounded-3xl" />
          ) : error ? (
            <p className="text-danger text-sm">{error}</p>
          ) : (
            <>
              <p className="text-xs uppercase tracking-[3px] text-white/50 font-heading mb-1">{name}{admin ? ` · ${admin}` : ''}</p>
              <div className="text-7xl sm:text-8xl leading-none mb-2" style={{ filter: 'drop-shadow(0 6px 20px rgba(0,0,0,0.4))' }}>{emoji}</div>
              <p className="font-display leading-none" style={{ fontSize: 'clamp(64px, 14vw, 104px)', fontWeight: 200, letterSpacing: '-3px', color: tempColor(Math.round(cur.temperature_2m)) }}>{fmtTemp(cur.temperature_2m, tempUnit)}</p>
              <p className="text-lg text-white/75 font-heading mt-1">{label}</p>
            </>
          )}
        </motion.div>

        {/* Vigilance Météo-France (department-level, via MeteoAlarm) */}
        {vigilance.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="mb-5 rounded-2xl p-3.5 backdrop-blur-md"
            style={{ background: `${vigilance[0].color}1f`, border: `1px solid ${vigilance[0].color}` }}>
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-5 h-5" style={{ color: vigilance[0].color }} />
              <span className="font-heading font-bold text-sm" style={{ color: vigilance[0].color }}>
                Vigilance {vigilance[0].levelLabel} · Météo-France
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {vigilance.map((v, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold"
                  style={{ backgroundColor: `${v.color}26`, color: v.color, border: `1px solid ${v.color}66` }}>
                  <span>{v.icon}</span>{v.type} · {v.levelLabel}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {!loading && !error && data && (
          <>
            {/* Smart insights — résumé foufous + alertes malines */}
            <WeatherInsights forecast={data} airQuality={aq} variant="full" />

            {/* Quick stats */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-7">
              <QuickStat icon={Thermometer} label="Ressenti" value={fmtTemp(cur.apparent_temperature, tempUnit)} />
              <QuickStat icon={Wind} label={`Vent ${windUnitLabel(windUnit)}`} value={`${fmtWind(cur.wind_speed_10m, windUnit)} (${fmtWind(cur.wind_gusts_10m, windUnit)})`} />
              <QuickStat icon={Droplets} label="Humidité" value={`${cur.relative_humidity_2m}%`} />
              <QuickStat icon={Sun} label="UV" value={`${today?.uvMax ?? 0}`} />
            </motion.div>

            {/* Risk tiles */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <p className="text-[11px] font-heading font-bold tracking-[2px] text-white/45 mb-2.5">RISQUES DU JOUR</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <BigTile icon={Zap} label="Orage" risk={orageTile} value={orageText(orageTile)} sub={`${Math.round(todayCape)} J/kg CAPE`} />
                <BigTile icon={CloudRain} label="Pluie" risk={pluieTile} value={`${(today?.precipMm ?? 0).toFixed(1)} mm`} sub={`${today?.precipProb ?? 0}% de probabilité`} />
                <BigTile icon={Wind} label="Vent" risk={ventTile} value={`${fmtWind(today?.windKmh, windUnit)} ${windUnitLabel(windUnit)}`} sub={`rafales ${fmtWind(today?.gustKmh, windUnit)} ${windUnitLabel(windUnit)}`} />
              </div>
            </motion.div>

            {/* Meteogram 48h */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }} className="mt-7">
              <p className={sectionLabel}>TENDANCE 48H · TEMPÉRATURE & PLUIE</p>
              <Meteogram data={data} tempUnit={tempUnit} />
            </motion.div>

            {/* Air quality + pollen, marine (coastal), snow/ski (mountains) */}
            {(aq?.current || marine?.current || data) && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="mt-7 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <AirPollen aq={aq} />
                <MarineCard marine={marine} tempUnit={tempUnit} />
                <SnowSki data={data} days={days} tempUnit={tempUnit} />
              </motion.div>
            )}

            {/* Forecast table (compact, left) + big live city maps 2x2 (right) */}
            <div className="mt-7 lg:grid lg:grid-cols-[1fr_2fr] lg:gap-6 lg:items-start">
              {/* Left — 14-day forecast table (stays in place while scrolling the maps) */}
              <div className="lg:sticky lg:top-3 lg:self-start lg:max-h-[calc(100vh-1.5rem)] lg:overflow-y-auto no-scrollbar">
                <p className="text-[11px] font-heading font-bold tracking-[2px] text-white/45 mb-2.5">PRÉVISIONS 14 JOURS</p>
                <ForecastTable days={days} tempUnit={tempUnit} windUnit={windUnit} />
              </div>

              {/* Right — big live maps centred on the city */}
              <div className="mt-8 lg:mt-0">
                <div className="flex items-center justify-between gap-3 mb-2.5 flex-wrap">
                  <p className="text-[11px] font-heading font-bold tracking-[2px] text-white/45">EN DIRECT · {name.toUpperCase()}</p>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-white/40 font-heading">Hauteur</span>
                      <input type="range" min={150} max={700} step={10} value={mapSize}
                        onChange={(e) => setMapSize(Number(e.target.value))}
                        className="w-28 accent-sky-400 cursor-pointer" />
                      <span className="text-[10px] font-mono text-white/40 w-9 text-right">{mapSize}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-white/40 font-heading">Largeur</span>
                      <input type="range" min={280} max={1100} step={20} value={mapWidth}
                        onChange={(e) => setMapWidth(Number(e.target.value))}
                        className="w-28 accent-sky-400 cursor-pointer" />
                      <span className="text-[10px] font-mono text-white/40 w-9 text-right">{mapWidth}</span>
                    </div>
                  </div>
                </div>
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${mapWidth}px), 1fr))` }}>
                  <div>
                    <div className="flex items-center gap-1.5 mb-2 px-1 text-sky-300"><CloudRain className="w-4 h-4" /><span className="text-xs font-heading font-bold uppercase tracking-wider">Radar pluie</span></div>
                    <MapEmbed src={windyUrl(lat, lon, 'rain', 8)} height={mapSize} note="Windy · live" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-2 px-1 text-emerald-300"><Wind className="w-4 h-4" /><span className="text-xs font-heading font-bold uppercase tracking-wider">Vent</span></div>
                    <MapEmbed src={windyUrl(lat, lon, 'wind', 8)} height={mapSize} note="Windy · live" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-2 px-1 text-amber-300"><Zap className="w-4 h-4" /><span className="text-xs font-heading font-bold uppercase tracking-wider">Impacts foudre</span></div>
                    <MapEmbed src={blitzortungUrl(lat, lon, 9)} height={mapSize} note="Blitzortung · live" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-2 px-1 text-blue-300"><CloudRain className="w-4 h-4" /><span className="text-xs font-heading font-bold uppercase tracking-wider">Pluie HD · Meteociel</span></div>
                    <MapEmbed src={METEOCIEL_RAIN_HD} height={mapSize} canvasCrop={{ x: 659, y: 345, w: 768, h: 808, frameW: 1900, fit: 'width' }} note="Meteociel · animation" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-2 px-1 text-cyan-200"><Snowflake className="w-4 h-4" /><span className="text-xs font-heading font-bold uppercase tracking-wider">Neige · Meteociel</span></div>
                    <MapEmbed src={METEOCIEL_SNOW} height={mapSize} canvasCrop={{ x: 659, y: 345, w: 768, h: 808, frameW: 1900, fit: 'width' }} note="Meteociel · animation" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-2 px-1 text-yellow-300"><Zap className="w-4 h-4" /><span className="text-xs font-heading font-bold uppercase tracking-wider">Foudre en direct · Meteociel</span></div>
                    <MapEmbed src={METEOCIEL_FOUDRE} height={mapSize} canvasCrop={{ x: 648, y: 322, w: 768, h: 808, frameW: 1900, fit: 'width' }} note="Meteociel · plein écran" />
                  </div>
                </div>
              </div>
            </div>

            <p className="text-center text-[11px] mt-6 text-white/30">
              Court terme Météo-France (AROME/ARPEGE) · 14 jours ECMWF · UV Open-Meteo
            </p>
          </>
        )}
      </div>
    </div>
  );
}
