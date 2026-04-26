import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame, Star, Trophy, BarChart3, Zap,
  Calendar, Settings, ChevronRight
} from 'lucide-react';
import { useUIStore } from '../../store';
import clsx from 'clsx';

const NAV_ITEMS = [
  { to: '/', icon: Flame, label: 'Pronostics', exact: true },
  { to: '/matchs', icon: Calendar, label: 'Matchs' },
  { to: '/leagues', icon: Trophy, label: 'Ligues' },
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

export default function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useUIStore();

  const content = (
    <div className="flex flex-col h-full py-6 px-4">
      {/* Logo */}
      <NavLink to="/" className="flex items-center gap-3 mb-8 px-2">
        <div className="w-9 h-9 rounded-xl bg-brand-gradient flex items-center justify-center shadow-glow">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-black text-white text-lg leading-none">PronoStats</p>
          <p className="text-xs text-brand-400 font-medium">Football Intelligence</p>
        </div>
      </NavLink>

      {/* Navigation */}
      <nav className="space-y-1 mb-6">
        {NAV_ITEMS.map(({ to, icon: Icon, label, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
              isActive
                ? 'bg-brand-500/15 text-brand-400 shadow-glow'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            )}
          >
            <Icon className="w-4.5 h-4.5 w-[18px] h-[18px]" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Divider */}
      <div className="border-t border-white/5 mb-6" />

      {/* Top Leagues */}
      <div className="mb-2">
        <div className="flex items-center justify-between px-2 mb-3">
          <p className="text-xs font-semibold text-white/30 uppercase tracking-wider">Ligues</p>
          <NavLink to="/leagues" className="text-xs text-brand-400 hover:text-brand-300">Voir tout</NavLink>
        </div>
        <div className="space-y-0.5">
          {TOP_LEAGUES.map((league) => (
            <NavLink
              key={league.id}
              to={`/matchs?league=${league.id}`}
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition-all group"
            >
              <span className="text-base leading-none">{league.flag}</span>
              <span className="flex-1 truncate group-hover:text-white/90">{league.name}</span>
              <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
            </NavLink>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-dark-700/50 border border-white/5">
          <div className="w-8 h-8 rounded-full bg-brand-gradient flex items-center justify-center text-xs font-bold text-white">P</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">PronoStats</p>
            <p className="text-xs text-white/30">Version 1.0</p>
          </div>
          <Settings className="w-4 h-4 text-white/30 hover:text-white cursor-pointer transition-colors" />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 bg-dark-900/95 border-r border-white/5 flex-col z-50">
        {content}
      </aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-64 bg-dark-900 border-r border-white/5 flex flex-col z-50"
            >
              {content}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
