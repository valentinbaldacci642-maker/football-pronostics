import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, MapPin, Wind, Droplets, Sun, CloudLightning,
  Thermometer, RefreshCw, AlertTriangle,
} from 'lucide-react';
import {
  getForecast, wmo, windRisk, rainRisk, uvRisk, stormRisk,
} from '../../services/meteo';

const PAGE_BG = 'radial-gradient(1200px 600px at 50% -10%, #0a1628 0%, #050a12 60%)';
const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

function RiskTile({ icon: Icon, label, value, risk }) {
  return (
    <div className={`rounded-2xl border ${risk.border} ${risk.bg} p-3.5`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${risk.text}`} />
        <span className="text-xs font-heading font-semibold text-white/55">{label}</span>
      </div>
      <p className="text-lg font-display text-white leading-none">{value}</p>
      <p className={`text-xs font-heading font-bold mt-1 ${risk.text}`}>{risk.label}</p>
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
    setLoading(true);
    setError(null);
    getForecast(lat, lon)
      .then(setData)
      .catch((e) => setError(e?.message || 'Erreur de chargement'))
      .finally(() => setLoading(false));
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

        {data && !loading && <Content data={data} />}
      </div>
    </div>
  );
}

function Content({ data }) {
  const cur = data.current || {};
  const daily = data.daily || {};
  const hourly = data.hourly || {};
  const { label, emoji } = wmo(cur.weather_code);

  // Today's daily values for the risk tiles.
  const todayUv = daily.uv_index_max?.[0] ?? 0;
  const todayGust = daily.wind_gusts_10m_max?.[0] ?? cur.wind_gusts_10m ?? 0;
  const todayRain = daily.precipitation_sum?.[0] ?? 0;
  const todayProb = daily.precipitation_probability_max?.[0] ?? null;

  const wRisk = windRisk(todayGust);
  const rRisk = rainRisk(todayRain);
  const uRisk = uvRisk(todayUv);
  const sRisk = stormRisk(daily.weather_code?.[0], todayProb);

  // Alerts: surface anything >= MODERE in plain language.
  const alerts = [];
  if (windRisk(todayGust).label !== 'Faible') alerts.push(`Vent : rafales jusqu'à ${Math.round(todayGust)} km/h`);
  if (rainRisk(todayRain).label !== 'Faible') alerts.push(`Pluie : ${todayRain.toFixed(1)} mm attendus`);
  if (uvRisk(todayUv).label !== 'Faible') alerts.push(`UV élevé : indice ${Math.round(todayUv)}`);
  if (stormRisk(daily.weather_code?.[0], todayProb).label !== 'Faible') alerts.push('Risque orageux aujourd’hui');

  // Next 24h hourly slice starting from now.
  const nowIdx = (() => {
    const times = hourly.time || [];
    const now = Date.now();
    for (let i = 0; i < times.length; i++) if (new Date(times[i]).getTime() >= now - 3600000) return i;
    return 0;
  })();
  const hourSlice = (hourly.time || []).slice(nowIdx, nowIdx + 24);

  return (
    <div className="space-y-5 mt-5">
      {/* Current weather hero */}
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
            <p className="flex items-center justify-end gap-1.5 text-white/55"><Wind className="w-3.5 h-3.5" /> {Math.round(cur.wind_speed_10m)} km/h</p>
            <p className="flex items-center justify-end gap-1.5 text-white/55"><Droplets className="w-3.5 h-3.5" /> {cur.relative_humidity_2m}%</p>
            <p className="flex items-center justify-end gap-1.5 text-white/55"><Thermometer className="w-3.5 h-3.5" /> {cur.precipitation} mm</p>
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

      {/* Risk tiles */}
      <div className="grid grid-cols-2 gap-3">
        <RiskTile icon={CloudLightning} label="Orage" value={wmo(daily.weather_code?.[0]).emoji} risk={sRisk} />
        <RiskTile icon={Droplets} label="Pluie" value={`${todayRain.toFixed(1)} mm`} risk={rRisk} />
        <RiskTile icon={Wind} label="Vent" value={`${Math.round(todayGust)} km/h`} risk={wRisk} />
        <RiskTile icon={Sun} label="UV" value={`${Math.round(todayUv)}`} risk={uRisk} />
      </div>

      {/* Hourly 24h */}
      {hourSlice.length > 0 && (
        <div className="glass-card p-4">
          <p className="text-xs font-heading font-bold uppercase tracking-wider text-white/40 mb-3">Prochaines 24h</p>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {hourSlice.map((t, i) => {
              const idx = nowIdx + i;
              const temp = hourly.temperature_2m?.[idx];
              const prob = hourly.precipitation_probability?.[idx];
              const code = hourly.weather_code?.[idx];
              const h = new Date(t).getHours();
              return (
                <div key={t} className="flex flex-col items-center gap-1 flex-shrink-0 w-12">
                  <span className="text-[11px] text-white/40 font-mono">{i === 0 ? "Maint." : `${h}h`}</span>
                  <span className="text-lg leading-none">{wmo(code).emoji}</span>
                  <span className="text-sm font-heading font-semibold text-white/85">{Math.round(temp)}°</span>
                  {prob != null && prob > 0 && <span className="text-[10px] text-sky-400 font-mono">{prob}%</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 7-day forecast */}
      {(daily.time || []).length > 0 && (
        <div className="glass-card overflow-hidden">
          <p className="text-xs font-heading font-bold uppercase tracking-wider text-white/40 px-4 pt-4 pb-2">7 jours</p>
          <div className="divide-y divide-white/[0.04]">
            {daily.time.map((t, i) => {
              const d = new Date(t);
              const dayLabel = i === 0 ? "Aujourd'hui" : DAYS_FR[d.getDay()] + ' ' + d.getDate();
              const { emoji } = wmo(daily.weather_code?.[i]);
              const tmax = Math.round(daily.temperature_2m_max?.[i]);
              const tmin = Math.round(daily.temperature_2m_min?.[i]);
              const prob = daily.precipitation_probability_max?.[i];
              return (
                <div key={t} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-sm font-heading text-white/70 w-24 capitalize">{dayLabel}</span>
                  <span className="text-xl w-7 text-center">{emoji}</span>
                  {prob != null && <span className="text-xs text-sky-400/80 font-mono w-10 text-right">{prob > 0 ? `${prob}%` : ''}</span>}
                  <div className="flex-1" />
                  <span className="text-sm font-heading text-white/40 w-8 text-right">{tmin}°</span>
                  <span className="text-sm font-heading font-bold text-white w-8 text-right">{tmax}°</span>
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
