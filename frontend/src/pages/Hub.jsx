import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Target, CloudSun, ChevronRight } from 'lucide-react';

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

      <p className="mt-10 text-xs text-white/20 font-heading">© SiteDesFoufous</p>
    </div>
  );
}
