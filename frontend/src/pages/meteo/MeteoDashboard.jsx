import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, RefreshCw, Wind, Droplets, Sun, Thermometer, CloudRain, Zap, Snowflake } from 'lucide-react';
import {
  getForecast, wmo, windRisk, rainRisk, uvRisk, stormRisk, severeStormRisk, maxRisk,
  dirToCompass, RISK, windyUrl, blitzortungUrl, tempColor,
} from '../../services/meteo';
import { InfoBadge, orageText, violentText } from '../../components/meteo/RiskUI';
import MapEmbed from '../../components/meteo/MapEmbed';

const DAYS_FR = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
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
    hours: hoursByDate[date] || [],
  }));
}

function HourRow({ h }) {
  const gust = windRisk(h.gustKmh);
  const precip = rainRisk(h.precipMm);
  const orage = stormRisk(h.wmoCode, h.cape);
  const violent = severeStormRisk(h.wmoCode);
  return (
    <div className="flex items-start gap-2 py-1.5 border-t border-white/[0.06]">
      <span className="text-xs font-mono w-8 flex-shrink-0 pt-0.5 text-white/40">{String(h.hour).padStart(2, '0')}h</span>
      <span className="text-base w-6 flex-shrink-0 text-center">{wmo(h.wmoCode).emoji}</span>
      <div className="w-11 flex-shrink-0">
        <span className="text-[13px] font-bold" style={{ color: tempColor(h.tempC) }}>{h.tempC}°</span>
        {h.feelsLikeC !== h.tempC && <span className="block text-[10px] text-white/35">{h.feelsLikeC}°</span>}
      </div>
      <div className="flex-1 flex flex-wrap gap-1">
        <InfoBadge icon="💨" risk={gust} text={`${h.windKmh} (↑${h.gustKmh}) ${dirToCompass(h.windDir)}`} />
        <InfoBadge icon="🌧️" risk={precip} text={`${h.precipMm.toFixed(1)}mm · ${h.precipProb}%`} />
        {h.uvIndex >= 3 && <InfoBadge icon="☀️" risk={uvRisk(h.uvIndex)} text={`UV ${h.uvIndex}`} />}
        {orage.key !== 'FAIBLE' && <InfoBadge icon="⛈️" risk={orage} text={orageText(orage)} />}
        {violent.key !== 'FAIBLE' && <InfoBadge icon="🌩️" risk={violent} text={violentText(violent)} />}
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

function ForecastRow({ day, isToday }) {
  const [expanded, setExpanded] = useState(false);
  const { windR, precipR, orageR, violentR, top } = dayRisks(day);
  const showViolent = violentR.key !== 'FAIBLE';
  return (
    <>
      <tr onClick={() => setExpanded((e) => !e)} className="cursor-pointer border-t border-white/[0.06] hover:bg-white/[0.04] transition-colors align-middle">
        <td className="pl-3 pr-2 py-2.5 relative">
          <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full" style={{ background: top.color, opacity: 0.85 }} />
          <span className="font-heading font-bold capitalize text-sm" style={{ color: isToday ? '#7dd3fc' : '#e2e8f0' }}>
            {isToday ? "Auj." : fmtDate(day.date)}
          </span>
        </td>
        <td className="px-2 text-center text-lg" title={day.desc}>{day.emoji}</td>
        <td className="px-2 text-right whitespace-nowrap">
          <span className="font-display text-base" style={{ color: tempColor(day.tempMax) }}>{day.tempMax}°</span>
          <span className="text-xs ml-1" style={{ color: tempColor(day.tempMin), opacity: 0.85 }}>{day.tempMin}°</span>
        </td>
        <td className="px-2 text-right whitespace-nowrap">
          <span className="font-semibold text-sm" style={{ color: windR.color }}>{day.windKmh}</span>
          <span className="text-white/40 text-xs"> ↑{day.gustKmh}</span>
          <span className="text-white/35 text-[10px] ml-1">{dirToCompass(day.windDir)}</span>
        </td>
        <td className="px-2 text-right whitespace-nowrap">
          <span className="font-semibold text-sm" style={{ color: precipR.color }}>{day.precipProb}%</span>
          <span className="text-white/45 text-xs ml-1">{day.precipMm.toFixed(1)}mm</span>
        </td>
        <td className="px-2 text-center">
          <span className="font-semibold text-sm" style={{ color: uvRisk(day.uvMax).color }}>{day.uvMax}</span>
        </td>
        <td className="pr-3 pl-2 py-2.5 text-right">
          <Pill risk={orageR}>{showViolent ? `⚡ ${violentR.label}` : orageText(orageR)}</Pill>
        </td>
      </tr>
      {expanded && day.hours.length > 0 && (
        <tr>
          <td colSpan={7} className="px-3 pb-3 pt-1" style={{ background: 'rgba(0,0,0,0.18)' }}>
            {day.hours.map((h) => <HourRow key={h.hour} h={h} />)}
          </td>
        </tr>
      )}
    </>
  );
}

function ForecastTable({ days }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden backdrop-blur-md"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }}
    >
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-white/40 font-heading">
            <th className="text-left pl-3 pr-2 py-2.5 font-bold">Jour</th>
            <th className="px-2 py-2.5 font-bold">Ciel</th>
            <th className="px-2 py-2.5 text-right font-bold">Temp.</th>
            <th className="px-2 py-2.5 text-right font-bold">Vent</th>
            <th className="px-2 py-2.5 text-right font-bold">Pluie</th>
            <th className="px-2 py-2.5 text-center font-bold">UV</th>
            <th className="pr-3 pl-2 py-2.5 text-right font-bold">Orage</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day, i) => <ForecastRow key={day.date} day={day} isToday={i === 0} />)}
        </tbody>
      </table>
    </motion.div>
  );
}

function QuickStat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 rounded-xl px-3 py-2 backdrop-blur-md" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <Icon className="w-4 h-4 text-white/55 flex-shrink-0" />
      <div className="leading-none">
        <p className="text-[10px] uppercase tracking-wider text-white/40 font-heading">{label}</p>
        <p className="text-sm font-heading font-bold text-white/90 mt-0.5">{value}</p>
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
        <span className="text-xs font-bold px-2.5 py-1 rounded-full text-white" style={{ background: risk.color }}>{risk.label}</span>
      </div>
      <p className="text-sm font-heading font-semibold text-white/80">{label}</p>
      <p className="font-display text-xl text-white mt-0.5">{value}</p>
      {sub && <p className="text-[11px] mt-0.5" style={{ color: risk.color }}>{sub}</p>}
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) { setError('Coordonnées invalides'); setLoading(false); return; }
    setLoading(true); setError(null);
    getForecast(lat, lon).then(setData).catch((e) => setError(e?.message || 'Erreur')).finally(() => setLoading(false));
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
        <div className="flex items-center justify-between">
          <Link to="/meteo" className="inline-flex items-center gap-2 text-sm text-white/55 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Recherche
          </Link>
          <button onClick={load} className="p-2 rounded-full text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
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
              <p className="font-display leading-none" style={{ fontSize: 'clamp(64px, 14vw, 104px)', fontWeight: 200, letterSpacing: '-3px', color: tempColor(Math.round(cur.temperature_2m)) }}>{Math.round(cur.temperature_2m)}°</p>
              <p className="text-lg text-white/75 font-heading mt-1">{label}</p>
            </>
          )}
        </motion.div>

        {!loading && !error && data && (
          <>
            {/* Quick stats */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-7">
              <QuickStat icon={Thermometer} label="Ressenti" value={`${Math.round(cur.apparent_temperature)}°`} />
              <QuickStat icon={Wind} label="Vent" value={`${Math.round(cur.wind_speed_10m)} (${Math.round(cur.wind_gusts_10m)})`} />
              <QuickStat icon={Droplets} label="Humidité" value={`${cur.relative_humidity_2m}%`} />
              <QuickStat icon={Sun} label="UV" value={`${today?.uvMax ?? 0}`} />
            </motion.div>

            {/* Risk tiles */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <p className="text-[11px] font-heading font-bold tracking-[2px] text-white/45 mb-2.5">RISQUES DU JOUR</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <BigTile icon={Zap} label="Orage" risk={orageTile} value={orageText(orageTile)} sub={`${Math.round(todayCape)} J/kg CAPE`} />
                <BigTile icon={CloudRain} label="Pluie" risk={pluieTile} value={`${(today?.precipMm ?? 0).toFixed(1)} mm`} sub={`${today?.precipProb ?? 0}% de probabilité`} />
                <BigTile icon={Wind} label="Vent" risk={ventTile} value={`${today?.windKmh} km/h`} sub={`rafales ${today?.gustKmh} km/h`} />
              </div>
            </motion.div>

            {/* Forecast table (left half) + live city maps 2x2 (right half) */}
            <div className="mt-7 lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
              {/* Left — 14-day forecast table */}
              <div>
                <p className="text-[11px] font-heading font-bold tracking-[2px] text-white/45 mb-2.5">PRÉVISIONS 14 JOURS</p>
                <ForecastTable days={days} />
              </div>

              {/* Right — big live maps centred on the city */}
              <div className="mt-8 lg:mt-0">
                <p className="text-[11px] font-heading font-bold tracking-[2px] text-white/45 mb-2.5">EN DIRECT · {name.toUpperCase()}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2 px-1 text-sky-300"><CloudRain className="w-4 h-4" /><span className="text-xs font-heading font-bold uppercase tracking-wider">Radar pluie</span></div>
                    <MapEmbed src={windyUrl(lat, lon, 'rain', 8)} height={300} note="Windy · live" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-2 px-1 text-emerald-300"><Wind className="w-4 h-4" /><span className="text-xs font-heading font-bold uppercase tracking-wider">Vent</span></div>
                    <MapEmbed src={windyUrl(lat, lon, 'wind', 8)} height={300} note="Windy · live" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-2 px-1 text-cyan-200"><Snowflake className="w-4 h-4" /><span className="text-xs font-heading font-bold uppercase tracking-wider">Neige</span></div>
                    <MapEmbed src={windyUrl(lat, lon, 'snowAccu', 8)} height={300} note="Windy · accumulation" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-2 px-1 text-amber-300"><Zap className="w-4 h-4" /><span className="text-xs font-heading font-bold uppercase tracking-wider">Impacts foudre</span></div>
                    <MapEmbed src={blitzortungUrl(lat, lon, 9)} height={300} note="Blitzortung · live" />
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
