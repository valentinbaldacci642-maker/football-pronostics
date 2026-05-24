import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Target, CloudSun, ChevronRight, Flame } from 'lucide-react';
import { getForecast, getAlertCities, getRecentCities, wmo, tempColor } from '../services/meteo';
import { pronosticsApi } from '../services/api';
import WeatherInsights from '../components/meteo/WeatherInsights';

// SiteDesFoufous landing — the umbrella that gathers the projects. Each card
// links into a section. Standalone layout (no football sidebar/navbar).
const PROJECTS = [
  {
    to: '/pronos',
    icon: Target,
    title: 'PronosDesFoufous',
    subtitle: 'Pronostics football · value bets · live',
    accent: 'from-brand-500/20 to-brand-500/5 border-brand-500/30',
    iconColor: 'text-brand-400',
  },
  {
    to: '/meteo',
    icon: CloudSun,
    title: 'MimiMétéo',
    subtitle: 'Météo, orages, pluie & foudre en direct',
    accent: 'from-sky-500/20 to-sky-500/5 border-sky-500/30',
    iconColor: 'text-sky-400',
  },
];

// Compact "weather of the day" widget for the user's last/alert city.
function WeatherWidget() {
  const [city] = useState(() => getAlertCities()[0] || getRecentCities()[0] || null);
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!city) return;
    getForecast(city.lat, city.lon).then(setData).catch(() => {});
  }, [city]);
  if (!city) return null;
  const cur = data?.current;
  const { emoji, label } = wmo(cur?.weather_code);
  const to = `/meteo/ville?lat=${city.lat}&lon=${city.lon}&name=${encodeURIComponent(city.name)}`;
  return (
    <Link to={to} className="group block rounded-2xl border border-sky-500/25 bg-gradient-to-b from-sky-500/10 to-transparent p-4 transition-all hover:border-sky-400/40">
      <div className="flex items-center gap-3">
        <div className="text-3xl leading-none">{cur ? emoji : '⏳'}</div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wider text-white/40 font-heading">Météo · {city.name}</p>
          {cur ? (
            <p className="font-heading">
              <span className="font-display text-2xl" style={{ color: tempColor(Math.round(cur.temperature_2m)) }}>{Math.round(cur.temperature_2m)}°</span>
              <span className="text-sm text-white/55 ml-2">{label}</span>
            </p>
          ) : (
            <p className="text-sm text-white/40">Chargement…</p>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-white/25 group-hover:text-white/60 transition-colors" />
      </div>
      {data && <WeatherInsights forecast={data} variant="compact" />}
    </Link>
  );
}

// Compact "value bets of the day" widget.
function BetsWidget() {
  const [vbCount, setVbCount] = useState(null);
  const [best, setBest] = useState(null);
  useEffect(() => {
    pronosticsApi.getBestToday().then((res) => {
      const list = Array.isArray(res?.data) ? res.data : [];
      let count = 0;
      let top = null;
      for (const p of list) {
        const vbs = p.analysis?.odds?.valueBets || [];
        count += vbs.length;
        for (const vb of vbs) {
          if (vb?.edge != null && (!top || vb.edge > top.edge)) {
            top = { edge: vb.edge, selection: vb.selection, home: p.fixture?.teams?.home?.name, away: p.fixture?.teams?.away?.name };
          }
        }
      }
      setVbCount(count);
      setBest(top);
    }).catch(() => { setVbCount(0); });
  }, []);
  return (
    <Link to="/value-bets" className="group flex items-center gap-3 rounded-2xl border border-gold-500/25 bg-gradient-to-b from-gold-500/10 to-transparent p-4 transition-all hover:border-gold-400/40">
      <div className="w-11 h-11 rounded-xl bg-dark-900/50 flex items-center justify-center flex-shrink-0">
        <Flame className="w-5 h-5 text-gold-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wider text-white/40 font-heading">Value bets du jour</p>
        {vbCount == null ? (
          <p className="text-sm text-white/40">Chargement…</p>
        ) : (
          <p className="font-heading">
            <span className="font-display text-2xl text-gold-400">{vbCount}</span>
            <span className="text-sm text-white/55 ml-2 truncate">
              {best ? `top : ${best.selection} (+${best.edge.toFixed(1)}%)` : 'value bet' + (vbCount > 1 ? 's' : '')}
            </span>
          </p>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-white/25 group-hover:text-white/60 transition-colors" />
    </Link>
  );
}

export default function Hub() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5"
      style={{
        background: 'radial-gradient(1200px 600px at 50% -10%, #0a1628 0%, #050a12 60%)',
        paddingTop: 'calc(2rem + env(safe-area-inset-top, 0px))',
        paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <div className="flex items-center justify-center gap-3 mb-3">
          <img src="/ball.webp" alt="" className="w-12 h-12 rounded-2xl object-cover"
            style={{ filter: 'drop-shadow(0 0 12px rgba(34,197,94,0.4))' }}
            onError={(e) => { e.target.style.display = 'none'; }} />
          <h1 className="font-display text-4xl sm:text-5xl text-white tracking-wide leading-none">
            Site<span className="text-gradient-neon">DesFoufous</span>
          </h1>
        </div>
        <p className="text-sm text-white/40 font-heading font-medium">
          Tous tes outils au même endroit · choisis ta section
        </p>
      </motion.div>

      {/* Project cards */}
      <div className="w-full max-w-2xl grid gap-4 sm:grid-cols-2">
        {PROJECTS.map((p, i) => (
          <motion.div
            key={p.to}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 + i * 0.08 }}
          >
            <Link
              to={p.to}
              className={`group block rounded-2xl border bg-gradient-to-b ${p.accent} p-6 h-full transition-all hover:scale-[1.02] hover:border-white/25`}
            >
              <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 rounded-2xl bg-dark-900/50 flex items-center justify-center">
                  <p.icon className={`w-7 h-7 ${p.iconColor}`} />
                </div>
                <ChevronRight className="w-5 h-5 text-white/25 group-hover:text-white/60 group-hover:translate-x-1 transition-all" />
              </div>
              <h2 className="font-display text-2xl text-white tracking-wide leading-none mb-1.5">{p.title}</h2>
              <p className="text-sm text-white/45 font-heading leading-snug">{p.subtitle}</p>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Live widgets — weather of the day + value bets of the day */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.24 }}
        className="w-full max-w-2xl grid gap-4 sm:grid-cols-2 mt-4"
      >
        <BetsWidget />
        <WeatherWidget />
      </motion.div>

      <p className="mt-10 text-xs text-white/20 font-heading">© SiteDesFoufous</p>
    </div>
  );
}
