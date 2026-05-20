import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, MapPin, Wind, Droplets, Sun, CloudLightning, Zap,
  Thermometer, RefreshCw, AlertTriangle, ChevronDown, ChevronUp, ChevronRight,
} from 'lucide-react';
import {
  getForecast, wmo, windRisk, rainRisk, uvRisk, capeRisk,
} from '../../services/meteo';

const PAGE_BG = 'radial-gradient(1200px 600px at 50% -10%, #0a1628 0%, #050a12 60%)';
const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

// Build a query string carrying the city across detail routes.
function cityQS(params) {
  const q = new URLSearchParams();
  ['lat', 'lon', 'name', 'admin'].forEach((k) => { if (params.get(k)) q.set(k, params.get(k)); });
  return q.toString();
}

function Tile({ icon: Icon, label, value, risk, to }) {
  const inner = (
    <div className={`rounded-2xl border ${risk.border} ${risk.bg} p-3.5 h-full transition-transform hover:scale-[1.02]`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${risk.text}`} />
          <span className="text-xs font-heading font-semibold text-white/55">{label}</span>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-white/25" />
      </div>
      <p className="text-lg font-display text-white leading-none">{value}</p>
      <p className={`text-xs font-heading font-bold mt-1 ${risk.text}`}>{risk.label}</p>
    </div>
  );
  return to ? <Link to={to} className="block">{inner}</Link> : inner;
}

export default function MeteoDashboard() {
  const [params] = useSearchParams();
  const lat = parseFloat(params.get('lat'));
  const lon = parseFloat(params.get('lon'));
  const name = params.get('name') || 'Ville';
  const admin = params.get('admin') || '';
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

  return (
    <div className="min-h-screen px-5" style={{ background: PAGE_BG, paddingTop: 'calc(1.5rem + env(safe-area-inset-top, 0px))', paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <Link to="/meteo" className="inline-flex items-center gap-2 text-white/40 hover:text-white/70 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> Recherche
          </Link>
          <button onClick={load} className="p-2 rounded-lg text-white/40 hover:text-white/80 transition-colors" title="Actualiser">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-sky-400" />
          <h1 className="font-display text-3xl text-white tracking-wide leading-none">{name}</h1>
          {admin && <span className="text-sm text-white/35">· {admin}</span>}
        </div>

        {loading && (
          <div className="mt-8 space-y-3">
            <div className="h-32 skeleton rounded-2xl" />
            <div className="grid grid-cols-2 gap-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 skeleton rounded-2xl" />)}</div>
          </div>
        )}

        {error && !loading && (
          <div className="glass-card p-8 mt-8 text-center space-y-2">
            <p className="text-3xl">⚠️</p>
            <p className="text-white/60 font-heading">{error}</p>
            <button onClick={load} className="btn-ghost mt-2 inline-flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Réessayer</button>
          </div>
        )}

        {data && !loading && <Content data={data} qs={qs} />}
      </div>
    </div>
  );
}

function Content({ data, qs }) {
  const cur = data.current || {};
  const daily = data.daily || {};
  const hourly = data.hourly || {};
  const { label, emoji } = wmo(cur.weather_code);
  const [openDay, setOpenDay] = useState(0);

  // Per-day max CAPE from hourly, for the storm tile + day rows.
  const dayCape = (dateStr) => {
    const times = hourly.time || [];
    let max = 0;
    for (let i = 0; i < times.length; i++) {
      if (times[i].startsWith(dateStr) && hourly.cape?.[i] != null) max = Math.max(max, hourly.cape[i]);
    }
    return max;
  };

  const todayUv = daily.uv_index_max?.[0] ?? 0;
  const todayGust = daily.wind_gusts_10m_max?.[0] ?? cur.wind_gusts_10m ?? 0;
  const todayWind = daily.wind_speed_10m_max?.[0] ?? cur.wind_speed_10m ?? 0;
  const todayRain = daily.precipitation_sum?.[0] ?? 0;
  const todayCape = dayCape(daily.time?.[0] || '');

  const wRisk = windRisk(todayGust);
  const rRisk = rainRisk(todayRain);
  const uRisk = uvRisk(todayUv);
  const cRisk = capeRisk(todayCape);

  const alerts = [];
  if (wRisk.label !== 'Faible') alerts.push(`Vent : rafales jusqu'à ${Math.round(todayGust)} km/h`);
  if (rRisk.label !== 'Faible') alerts.push(`Pluie : ${todayRain.toFixed(1)} mm attendus`);
  if (uRisk.label !== 'Faible') alerts.push(`UV élevé : indice ${Math.round(todayUv)}`);
  if (cRisk.label !== 'Faible') alerts.push(`Risque orageux (CAPE ${Math.round(todayCape)} J/kg)`);

  return (
    <div className="space-y-5 mt-5">
      {/* Current hero */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-end gap-2">
              <span className="font-display text-6xl text-white leading-none">{Math.round(cur.temperature_2m)}°</span>
              <span className="text-5xl leading-none">{emoji}</span>
            </div>
            <p className="text-white/70 font-heading font-semibold mt-2">{label}</p>
            <p className="text-sm text-white/40 mt-0.5">Ressenti {Math.round(cur.apparent_temperature)}°</p>
          </div>
          <div className="text-right space-y-1.5 text-sm">
            <p className="flex items-center justify-end gap-1.5 text-white/55"><Wind className="w-3.5 h-3.5" /> {Math.round(cur.wind_speed_10m)} <span className="text-white/35">({Math.round(cur.wind_gusts_10m)})</span> km/h</p>
            <p className="flex items-center justify-end gap-1.5 text-white/55"><Droplets className="w-3.5 h-3.5" /> {cur.relative_humidity_2m}%</p>
            <p className="flex items-center justify-end gap-1.5 text-white/55"><Sun className="w-3.5 h-3.5" /> UV {Math.round(todayUv)}</p>
          </div>
        </div>
      </motion.div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-amber-300 font-heading font-bold text-sm">
            <AlertTriangle className="w-4 h-4" /> Alertes du jour
          </div>
          {alerts.map((a, i) => <p key={i} className="text-xs text-amber-200/80 pl-6">• {a}</p>)}
        </div>
      )}

      {/* 4 risk tiles → detail screens (Orage / Pluie / Vent / Foudre) */}
      <div className="grid grid-cols-2 gap-3">
        <Tile icon={CloudLightning} label="Orage" value={`${Math.round(todayCape)} J/kg`} risk={cRisk} to={`/meteo/detail?type=orage&${qs}`} />
        <Tile icon={Droplets} label="Pluie" value={`${todayRain.toFixed(1)} mm`} risk={rRisk} to={`/meteo/detail?type=pluie&${qs}`} />
        <Tile icon={Wind} label="Vent" value={`${Math.round(todayWind)} (${Math.round(todayGust)})`} risk={wRisk} to={`/meteo/detail?type=vent&${qs}`} />
        <Tile icon={Zap} label="Foudre" value="En direct" risk={cRisk} to={`/meteo/detail?type=foudre&${qs}`} />
      </div>

      {/* 14-day forecast with per-day hourly drill-down */}
      {(daily.time || []).length > 0 && (
        <div className="glass-card overflow-hidden">
          <p className="text-xs font-heading font-bold uppercase tracking-wider text-white/40 px-4 pt-4 pb-2">14 jours · clique un jour pour le détail heure par heure</p>
          <div className="divide-y divide-white/[0.04]">
            {daily.time.map((t, i) => {
              const d = new Date(t + 'T12:00:00');
              const dayLabel = i === 0 ? "Aujourd'hui" : `${DAYS_FR[d.getDay()]} ${d.getDate()}`;
              const { emoji: dEmoji } = wmo(daily.weather_code?.[i]);
              const tmax = Math.round(daily.temperature_2m_max?.[i]);
              const tmin = Math.round(daily.temperature_2m_min?.[i]);
              const prob = daily.precipitation_probability_max?.[i];
              const gust = Math.round(daily.wind_gusts_10m_max?.[i] ?? 0);
              const open = openDay === i;
              return (
                <div key={t}>
                  <button onClick={() => setOpenDay(open ? -1 : i)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03] transition-colors text-left">
                    <span className="text-sm font-heading text-white/70 w-20 capitalize">{dayLabel}</span>
                    <span className="text-xl w-7 text-center">{dEmoji}</span>
                    {prob != null && <span className="text-xs text-sky-400/80 font-mono w-9 text-right">{prob > 0 ? `${prob}%` : ''}</span>}
                    <div className="flex-1" />
                    <span className="text-sm font-heading text-white/40 w-7 text-right">{tmin}°</span>
                    <span className="text-sm font-heading font-bold text-white w-7 text-right">{tmax}°</span>
                    {open ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
                  </button>
                  {open && <HourlyDay hourly={hourly} dateStr={t} />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-center text-[11px] text-white/25 font-heading">Données Open-Meteo · modèle Météo-France</p>
    </div>
  );
}

// Hour-by-hour breakdown for one day: hour, sky, temp, precip % + mm, wind+gusts, UV.
function HourlyDay({ hourly, dateStr }) {
  const times = hourly.time || [];
  const rows = [];
  for (let i = 0; i < times.length; i++) {
    if (!times[i].startsWith(dateStr)) continue;
    rows.push({
      h: new Date(times[i]).getHours(),
      temp: hourly.temperature_2m?.[i],
      prob: hourly.precipitation_probability?.[i],
      mm: hourly.precipitation?.[i],
      code: hourly.weather_code?.[i],
      wind: hourly.wind_speed_10m?.[i],
      gust: hourly.wind_gusts_10m?.[i],
      uv: hourly.uv_index?.[i],
    });
  }
  if (rows.length === 0) return null;

  return (
    <div className="bg-dark-900/40 px-2 py-1 overflow-x-auto">
      <table className="w-full text-xs min-w-[480px]">
        <thead>
          <tr className="text-white/30 font-heading">
            <th className="text-left py-1.5 px-2 font-semibold">Heure</th>
            <th className="px-1"></th>
            <th className="text-right py-1.5 px-2 font-semibold">Temp</th>
            <th className="text-right py-1.5 px-2 font-semibold">Pluie</th>
            <th className="text-right py-1.5 px-2 font-semibold">Vent</th>
            <th className="text-right py-1.5 px-2 font-semibold">UV</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.h} className="border-t border-white/[0.03]">
              <td className="py-1.5 px-2 text-white/55 font-mono">{String(r.h).padStart(2, '0')}h</td>
              <td className="px-1 text-center">{wmo(r.code).emoji}</td>
              <td className="py-1.5 px-2 text-right text-white/85 font-mono">{Math.round(r.temp)}°</td>
              <td className="py-1.5 px-2 text-right font-mono">
                <span className="text-sky-400">{r.prob ?? 0}%</span>
                {r.mm > 0 && <span className="text-white/40 ml-1">{r.mm.toFixed(1)}mm</span>}
              </td>
              <td className="py-1.5 px-2 text-right text-white/55 font-mono">
                {Math.round(r.wind)} <span className="text-white/30">({Math.round(r.gust)})</span>
              </td>
              <td className="py-1.5 px-2 text-right text-white/55 font-mono">{Math.round(r.uv ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
