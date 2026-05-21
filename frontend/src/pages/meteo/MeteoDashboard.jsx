import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Star } from 'lucide-react';
import {
  getForecast, wmo, windRisk, rainRisk, uvRisk, stormRisk, severeStormRisk, maxRisk,
  dirToCompass, RISK,
} from '../../services/meteo';
import { InfoBadge, RiskTile, orageText, violentText } from '../../components/meteo/RiskUI';

const DAYS_FR = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function cityQS(params) {
  const q = new URLSearchParams();
  ['lat', 'lon', 'name', 'admin'].forEach((k) => { if (params.get(k)) q.set(k, params.get(k)); });
  return q.toString();
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
}

// Build {day + its hours} structures from the Open-Meteo arrays.
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
  const orage = maxRisk(stormRisk(h.wmoCode, h.cape), RISK.FAIBLE);
  const violent = severeStormRisk(h.wmoCode);
  const w = wmo(h.wmoCode);
  return (
    <div className="flex items-start gap-2 py-1.5 border-t border-white/[0.05]">
      <span className="text-xs font-semibold w-7 flex-shrink-0" style={{ color: '#64748b' }}>{String(h.hour).padStart(2, '0')}h</span>
      <div className="w-12 flex-shrink-0">
        <span className="text-[13px] font-semibold" style={{ color: '#94a3b8' }}>{h.tempC}°</span>
        {h.feelsLikeC !== h.tempC && <span className="block text-[10px]" style={{ color: '#475569' }}>res. {h.feelsLikeC}°</span>}
      </div>
      <div className="flex-1 flex flex-wrap gap-1">
        <InfoBadge icon="💨" risk={gust} text={`${h.windKmh} (↑${h.gustKmh}) km/h ${dirToCompass(h.windDir)}`} />
        <InfoBadge icon="🌧️" risk={precip} text={`${h.precipMm.toFixed(1)} mm · ${h.precipProb}%`} />
        {h.uvIndex >= 3 && <InfoBadge icon="☀️" risk={uvRisk(h.uvIndex)} text={`UV ${h.uvIndex}`} />}
        {orage.key !== 'FAIBLE' && <InfoBadge icon="⛈️" risk={orage} text={orageText(orage)} />}
        {violent.key !== 'FAIBLE' && <InfoBadge icon="🌩️" risk={violent} text={violentText(violent)} />}
      </div>
    </div>
  );
}

function DayCard({ day, isToday }) {
  const [expanded, setExpanded] = useState(false);
  const maxHourPrecip = day.hours.length ? Math.max(...day.hours.map((h) => h.precipMm)) : day.precipMm;
  const windR = windRisk(day.gustKmh);
  const precipR = rainRisk(maxHourPrecip);
  const orageR = day.hours.length
    ? day.hours.reduce((acc, h) => maxRisk(acc, stormRisk(h.wmoCode, h.cape)), RISK.FAIBLE)
    : stormRisk(day.code, 0);
  const violentR = day.hours.length
    ? day.hours.reduce((acc, h) => maxRisk(acc, severeStormRisk(h.wmoCode)), RISK.FAIBLE)
    : severeStormRisk(day.code);

  return (
    <div className="rounded-xl p-3.5 mb-2" style={{ backgroundColor: '#1e293b', border: isToday ? '1px solid #334155' : 'none' }}>
      <button onClick={() => setExpanded((e) => !e)} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold capitalize" style={{ color: isToday ? '#60a5fa' : '#94a3b8' }}>
              {isToday ? "Aujourd'hui" : fmtDate(day.date)}
            </p>
            <p className="text-xs mt-0.5 truncate flex items-center gap-1.5" style={{ color: '#475569' }}>
              <span>{day.emoji}</span>{day.desc}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[15px] font-semibold" style={{ color: '#f1f5f9' }}>{day.tempMin}° / {day.tempMax}°</p>
            <p className="text-[10px] mt-1" style={{ color: '#475569' }}>{expanded ? '▲' : '▼'}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          <InfoBadge icon="💨" risk={windR} text={`${day.windKmh} (↑${day.gustKmh}) km/h ${dirToCompass(day.windDir)}`} />
          <InfoBadge icon="🌧️" risk={precipR} text={`${day.precipProb}% · ${day.precipMm.toFixed(1)}mm`} />
          {day.uvMax >= 3 && <InfoBadge icon="☀️" risk={uvRisk(day.uvMax)} text={`UV ${day.uvMax}`} />}
          <InfoBadge icon="⛈️" risk={orageR} text={orageText(orageR)} />
          <InfoBadge icon="🌩️" risk={violentR} text={violentText(violentR)} />
        </div>
      </button>
      {expanded && day.hours.length > 0 && (
        <div className="mt-2">{day.hours.map((h) => <HourRow key={h.hour} h={h} />)}</div>
      )}
    </div>
  );
}

export default function MeteoDashboard() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const lat = parseFloat(params.get('lat'));
  const lon = parseFloat(params.get('lon'));
  const name = params.get('name') || 'Ville';
  const qs = cityQS(params);

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
  const orageTile = today
    ? (today.hours.length ? today.hours.reduce((a, h) => maxRisk(a, stormRisk(h.wmoCode, h.cape)), RISK.FAIBLE) : stormRisk(today.code, 0))
    : RISK.FAIBLE;
  const pluieTile = today ? rainRisk(today.hours.length ? Math.max(...today.hours.map((h) => h.precipMm)) : today.precipMm) : RISK.FAIBLE;
  const ventTile = today ? windRisk(today.gustKmh) : RISK.FAIBLE;

  return (
    <div className="min-h-screen" style={{ background: '#0f172a', paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}>
      <div className="max-w-2xl mx-auto px-4 pt-4">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Link to="/meteo" className="inline-flex items-center gap-2 text-sm transition-colors" style={{ color: '#94a3b8' }}>
            <ArrowLeft className="w-4 h-4" /> Recherche
          </Link>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(`/meteo/detail?type=pluie&${qs}`)} className="text-[13px] font-bold" style={{ color: '#60a5fa' }}>🌧️ Radar</button>
            <button onClick={() => navigate(`/meteo/detail?type=foudre&${qs}`)} className="text-[13px] font-bold" style={{ color: '#f59e0b' }}>⚡ Foudre</button>
            <button onClick={load} className="p-1.5" style={{ color: '#94a3b8' }}><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
          </div>
        </div>

        {/* Hero */}
        <div className="flex flex-col items-center py-7">
          {loading ? (
            <div className="h-20 w-32 skeleton rounded-2xl" />
          ) : error ? (
            <p style={{ color: '#ef4444' }} className="text-sm">{error}</p>
          ) : (
            <>
              <p style={{ fontSize: 64, fontWeight: 200, color: '#f1f5f9', letterSpacing: '-2px', lineHeight: 1 }}>{Math.round(cur.temperature_2m)}°C</p>
              <p style={{ fontSize: 18, color: '#94a3b8', marginTop: 4 }}>{wmo(cur.weather_code).emoji} {wmo(cur.weather_code).label}</p>
              <p style={{ fontSize: 14, color: '#475569', marginTop: 6 }}>{name} · ressenti {Math.round(cur.apparent_temperature)}°</p>
            </>
          )}
        </div>

        {!loading && !error && data && (
          <>
            {/* Risk tiles */}
            <p className="text-[11px] font-bold tracking-[1.2px] mt-3 mb-2.5" style={{ color: '#475569' }}>RISQUES ACTUELS</p>
            <div className="flex flex-wrap gap-2.5">
              <RiskTile icon="⛈️" label="Orage" risk={orageTile} subtitle={`${Math.round(today?.hours?.reduce((m, h) => Math.max(m, h.cape), 0) || 0)} J/kg CAPE`} onClick={() => navigate(`/meteo/detail?type=orage&${qs}`)} />
              <RiskTile icon="🌧️" label="Pluie" risk={pluieTile} subtitle={`${(today?.precipMm ?? 0).toFixed(1)} mm/j`} onClick={() => navigate(`/meteo/detail?type=pluie&${qs}`)} />
              <RiskTile icon="💨" label="Vent" risk={ventTile} subtitle={`${today?.windKmh} (↑${today?.gustKmh}) km/h`} onClick={() => navigate(`/meteo/detail?type=vent&${qs}`)} />
            </div>

            {/* 14-day forecast */}
            <p className="text-[11px] font-bold tracking-[1.2px] mt-5 mb-2.5" style={{ color: '#475569' }}>PRÉVISIONS 14 JOURS</p>
            {days.map((day, i) => <DayCard key={day.date} day={day} isToday={i === 0} />)}

            <p className="text-center text-[11px] mt-2" style={{ color: '#334155' }}>Données Open-Meteo · modèle Météo-France</p>
          </>
        )}
      </div>
    </div>
  );
}
