import { NavLink } from 'react-router-dom';
import { Flame, Calendar, Newspaper, Star, LayoutGrid, Target } from 'lucide-react';
import { useUIStore } from '../../store';
import clsx from 'clsx';

const TABS = [
  { to: '/',           icon: Target,   label: 'Pronos',     exact: true },
  { to: '/value-bets', icon: Flame,    label: 'Value bets'              },
  { to: '/matchs',     icon: Calendar, label: 'Matchs'                  },
  { to: '/favorites',  icon: Star,     label: 'Favoris'                 },
];

export default function BottomNav() {
  const { setSidebarOpen } = useUIStore();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch"
      style={{
        background: 'linear-gradient(180deg, #080e1a 0%, #050a12 100%)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {TABS.map(({ to, icon: Icon, label, exact }) => (
        <NavLink
          key={to}
          to={to}
          end={exact}
          className={({ isActive }) => clsx(
            'flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors cursor-pointer',
            isActive ? 'text-brand-400' : 'text-white/30 hover:text-white/60'
          )}
        >
          {({ isActive }) => (
            <>
              <div className={clsx(
                'w-9 h-7 flex items-center justify-center rounded-xl transition-all duration-200',
                isActive ? 'bg-brand-500/15' : ''
              )}>
                <Icon className={clsx('w-5 h-5 transition-all', isActive ? 'text-brand-400' : '')} />
              </div>
              <span className={clsx('text-[10px] font-heading font-semibold tracking-wide leading-none', isActive ? 'text-brand-400' : '')}>
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}

      {/* Plus button opens full sidebar */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-white/30 hover:text-white/60 transition-colors cursor-pointer"
      >
        <div className="w-9 h-7 flex items-center justify-center rounded-xl">
          <LayoutGrid className="w-5 h-5" />
        </div>
        <span className="text-[10px] font-heading font-semibold tracking-wide leading-none">Plus</span>
      </button>
    </nav>
  );
}
