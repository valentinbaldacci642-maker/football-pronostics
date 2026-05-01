import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame, Star, Trophy, BarChart3,
  Calendar, Settings, ChevronRight, Globe2, BookOpen, Newspaper
} from 'lucide-react';
import { useUIStore } from '../../store';
import clsx from 'clsx';

const NAV_ITEMS = [
  { to: '/', icon: Flame, label: 'Pronostics', exact: true },
  { to: '/matchs', icon: Calendar, label: 'Matchs' },
  { to: '/leagues', icon: Trophy, label: 'Ligues' },
  { to: '/worldcup', icon: Globe2, label: 'Coupe du Monde' },
  { to: '/news', icon: Newspaper, label: 'Actu Football' },
  { to: '/history', icon: BookOpen, label: 'Historique' },
  { to: '/favorites', icon: Star, label: 'Favoris' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
];

const TOP_LEAGUES = [
  { id: 39, name: 'Premier League', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', color: '#7c3aed' },
  { id: 140, name: 'La Liga', flag: '🇪🇸', color: '#dc2626' },
  { id: 78, name: 'Bundesliga', flag: '🇩🇪', color: '#d97706' },
  { id: 135, name: 'Serie A', flag: '🇮🇹', color: '#2563eb' },
  { id: 61, name: 'Ligue 1', flag: '🇫🇷', color: '#16a34a' },
  { id: 2, name: 'Champions League', flag: '🏆', color: '#b45309' },
];

function SidebarContent({ onClose }) {
  return (
    <div className="flex flex-col h-full py-5 px-3">
      {/* Logo */}
      <NavLink to="/" onClick={onClose} className="flex items-center gap-3 mb-6 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors">
        <div className="relative">
          <img src="/ball.webp" alt="logo" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" style={{ filter: 'drop-shadow(0 0 8px rgba(34,197,94,0.4))' }} />
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-brand-500 rounded-full border-2 border-dark-800" />
        </div>
        <div>
          <p className="font-display text-xl text-white leading-none tracking-wide">PronosDesFoufous</p>
          <p className="text-xs text-brand-400 font-heading font-semibold tracking-widest uppercase">Football Intelligence</p>
        </div>
      </NavLink>

      {/* Divider */}
      <div className="pitch-divider" />

      {/* Navigation */}
      <nav className="space-y-0.5 mb-4">
        {NAV_ITEMS.map(({ to, icon: Icon, label, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            onClick={onClose}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-heading font-semibold transition-all duration-200 cursor-pointer',
              isActive
                ? 'bg-brand-500/12 text-brand-400 nav-active-glow'
                : 'text-white/45 hover:text-white hover:bg-white/[0.06]'
            )}
          >
            {({ isActive }) => (
              <>
                <div className={clsx(
                  'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200',
                  isActive ? 'bg-brand-500/20 text-brand-400' : 'text-white/30'
                )}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="tracking-wide">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Divider */}
      <div className="pitch-divider" />

      {/* Top Leagues */}
      <div className="flex-1">
        <div className="flex items-center justify-between px-3 mb-2">
          <p className="section-subtitle text-[10px]">Ligues Top</p>
          <NavLink to="/leagues" className="text-xs text-brand-400/70 hover:text-brand-400 font-heading font-semibold transition-colors">Voir tout</NavLink>
        </div>
        <div className="space-y-0.5">
          {TOP_LEAGUES.map((league) => (
            <NavLink
              key={league.id}
              to={`/matchs?league=${league.id}`}
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm text-white/40 hover:text-white hover:bg-white/[0.05] transition-all group cursor-pointer"
            >
              <span className="text-sm leading-none w-5 text-center">{league.flag}</span>
              <span className="flex-1 truncate font-heading font-medium text-xs tracking-wide group-hover:text-white/90">{league.name}</span>
              <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />
            </NavLink>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4">
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-dark-700/60 border border-white/[0.05]">
          <img src="/ball.webp" alt="logo" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-heading font-semibold text-white truncate">PronosDesFoufous</p>
            <p className="text-xs text-white/25 font-mono">v1.0</p>
          </div>
          <Settings className="w-4 h-4 text-white/25 hover:text-white cursor-pointer transition-colors" />
        </div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const close = () => setSidebarOpen(false);

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 bg-dark-900/98 border-r border-white/[0.05] flex-col z-50"
        style={{ background: 'linear-gradient(180deg, #050a12 0%, #0a1020 100%)' }}>
        <SidebarContent onClose={close} />
      </aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={close}
              className="lg:hidden fixed inset-0 bg-black/70 z-40"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-64 border-r border-white/[0.05] flex flex-col z-50"
              style={{ background: 'linear-gradient(180deg, #050a12 0%, #0a1020 100%)' }}
            >
              <SidebarContent onClose={close} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
