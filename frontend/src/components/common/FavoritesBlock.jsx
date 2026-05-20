import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, ChevronRight } from 'lucide-react';
import { useFavoritesStore, useFavoriteTeamsStore } from '../../store';
import { fixturesApi } from '../../services/api';
import { formatTime } from '../../utils/format';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import { fr } from 'date-fns/locale';

const FINISHED = new Set(['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO']);

function whenLabel(iso) {
  try {
    const d = parseISO(iso);
    const time = formatTime(iso);
    if (isToday(d)) return `Aujourd'hui ${time}`;
    if (isTomorrow(d)) return `Demain ${time}`;
    return `${format(d, 'EEE d MMM', { locale: fr })} ${time}`;
  } catch (_) {
    return '';
  }
}

/**
 * Home-page block surfacing the user's favorites: favorite teams as quick
 * links + upcoming favorite matches (fetched by id). Renders nothing when
 * the user has no favorites, so it stays invisible until used.
 */
export default function FavoritesBlock() {
  const favoriteMatchIds = useFavoritesStore((s) => s.favorites);
  const favoriteTeams = useFavoriteTeamsStore((s) => s.favoriteTeams);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!favoriteMatchIds || favoriteMatchIds.length === 0) {
      setMatches([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    // API caps ids at 20 per call — take the first 20 favorites.
    const ids = favoriteMatchIds.slice(0, 20);
    fixturesApi.getByIds(ids)
      .then((res) => {
        if (cancelled) return;
        const list = (res?.response || [])
          .filter((f) => !FINISHED.has(f.fixture?.status?.short))
          .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
        setMatches(list);
      })
      .catch(() => { if (!cancelled) setMatches([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [favoriteMatchIds]);

  const hasTeams = favoriteTeams && favoriteTeams.length > 0;
  const hasMatches = matches.length > 0;
  if (!hasTeams && !hasMatches && !loading) return null;
  // Avoid an empty shell while loading if there are no teams either.
  if (!hasTeams && !hasMatches && loading && (!favoriteMatchIds || favoriteMatchIds.length === 0)) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4 space-y-3"
    >
      <div className="flex items-center gap-2">
        <Star className="w-4 h-4 text-gold-400" fill="currentColor" />
        <h2 className="font-heading font-bold text-white/85 tracking-wide">Mes favoris</h2>
      </div>

      {/* Favorite teams — quick links */}
      {hasTeams && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {favoriteTeams.map((t) => (
            <Link
              key={t.id}
              to={`/team/${t.id}`}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/[0.08] bg-dark-800/60 hover:border-brand-500/30 transition-all flex-shrink-0"
            >
              {t.logo && <img src={t.logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" onError={(e) => e.target.style.display = 'none'} />}
              <span className="text-xs font-heading font-semibold text-white/75 whitespace-nowrap">{t.name}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Upcoming favorite matches */}
      {hasMatches && (
        <div className="space-y-1.5">
          {matches.map((f) => {
            const home = f.teams?.home;
            const away = f.teams?.away;
            return (
              <Link
                key={f.fixture.id}
                to={`/match/${f.fixture.id}`}
                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.04] transition-colors group"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <img src={home?.logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" onError={(e) => e.target.style.display = 'none'} />
                  <span className="text-sm font-heading text-white/80 truncate">{home?.name}</span>
                  <span className="text-xs text-white/30 px-1">vs</span>
                  <span className="text-sm font-heading text-white/80 truncate">{away?.name}</span>
                  <img src={away?.logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" onError={(e) => e.target.style.display = 'none'} />
                </div>
                <span className="text-[11px] font-mono text-white/35 whitespace-nowrap flex-shrink-0">{whenLabel(f.fixture?.date)}</span>
                <ChevronRight className="w-3.5 h-3.5 text-white/20 flex-shrink-0 group-hover:text-white/40 transition-colors" />
              </Link>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
