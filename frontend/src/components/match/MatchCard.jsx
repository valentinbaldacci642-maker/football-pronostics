import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Star, TrendingUp, Flame, ChevronRight } from 'lucide-react';
import { useFavoritesStore } from '../../store';
import { formatTime, getMatchStatus, getScoreDisplay } from '../../utils/format';
import { getConfidenceBg, getConfidenceLabel } from '../../utils/probability';
import clsx from 'clsx';

function TeamLogo({ logo, name }) {
  return (
    <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
      <div className="w-12 h-12 rounded-xl bg-dark-700 flex items-center justify-center p-1.5 flex-shrink-0">
        <img
          src={logo}
          alt={name}
          className="w-full h-full object-contain"
          onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
        />
        <div className="hidden w-full h-full items-center justify-center text-lg font-bold text-white/40">
          {name?.charAt(0)}
        </div>
      </div>
      <p className="text-xs font-medium text-white/80 text-center leading-tight line-clamp-2 max-w-[80px]">{name}</p>
    </div>
  );
}

function LiveBadge({ elapsed }) {
  return (
    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-live-dot" />
      <span className="text-xs text-red-400 font-bold">{elapsed ? `${elapsed}'` : 'LIVE'}</span>
    </div>
  );
}

export default function MatchCard({ fixture, compact = false, prediction }) {
  const { toggle, isFavorite } = useFavoritesStore();
  const { teams, league, fixture: fix } = fixture;
  const home = teams?.home;
  const away = teams?.away;
  const id = fix?.id;
  const status = getMatchStatus(fixture);
  const score = getScoreDisplay(fixture);
  const isFav = isFavorite(id);

  const bestBet = prediction?.odds?.bestBet;
  const prob = prediction?.predictions?.probabilities;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="glass-card overflow-hidden group hover:border-white/10 hover:shadow-card transition-all duration-300"
    >
      {/* League header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          {league?.logo && (
            <img src={league.logo} alt={league.name} className="w-4 h-4 object-contain" />
          )}
          <span className="text-xs text-white/40 font-medium truncate max-w-[160px]">{league?.name}</span>
          {league?.round && <span className="text-xs text-white/20">· {league.round}</span>}
        </div>
        <div className="flex items-center gap-2">
          {status.type === 'live' ? (
            <LiveBadge elapsed={fix?.status?.elapsed} />
          ) : (
            <span className={clsx(
              'text-xs font-medium px-2 py-0.5 rounded-full',
              status.type === 'finished' ? 'text-white/30 bg-white/5' : 'text-brand-400'
            )}>
              {status.type === 'scheduled' ? formatTime(fix?.date) : status.label}
            </span>
          )}
          <button
            onClick={(e) => { e.preventDefault(); toggle(id); }}
            className={clsx(
              'p-1 rounded-lg transition-all',
              isFav ? 'text-gold-400' : 'text-white/20 hover:text-white/60'
            )}
          >
            <Star className="w-3.5 h-3.5" fill={isFav ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      {/* Match body */}
      <Link to={`/match/${id}`} className="block px-4 py-4">
        <div className="flex items-center gap-3">
          <TeamLogo logo={home?.logo} name={home?.name} />

          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            {score ? (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-white tabular-nums">{score.home}</span>
                <span className="text-white/30 text-sm">:</span>
                <span className="text-2xl font-black text-white tabular-nums">{score.away}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-white/20 text-xs font-medium">VS</span>
              </div>
            )}
            <span className="text-xs text-white/30">{fix?.venue?.city}</span>
          </div>

          <TeamLogo logo={away?.logo} name={away?.name} />
        </div>

        {/* Prediction bar */}
        {prob && (
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-xs text-white/40 font-medium">
              <span>1 — {prob.home?.toFixed(0)}%</span>
              <span>X — {prob.draw?.toFixed(0)}%</span>
              <span>2 — {prob.away?.toFixed(0)}%</span>
            </div>
            <div className="flex h-1.5 rounded-full overflow-hidden gap-0.5">
              <div className="bg-brand-500/80 rounded-full transition-all duration-700" style={{ width: `${prob.home}%` }} />
              <div className="bg-amber-500/60 rounded-full transition-all duration-700" style={{ width: `${prob.draw}%` }} />
              <div className="bg-blue-500/80 rounded-full transition-all duration-700" style={{ width: `${prob.away}%` }} />
            </div>
          </div>
        )}

        {/* Best bet */}
        {bestBet && (
          <div className="mt-3 flex items-center gap-2">
            <div className={clsx('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold', getConfidenceBg(bestBet.prob))}>
              <TrendingUp className="w-3 h-3" />
              <span>{bestBet.market}: {bestBet.selection}</span>
              <span className="opacity-70">@ {bestBet.odd?.toFixed(2)}</span>
            </div>
            {prediction?.odds?.valueBets?.length > 0 && (
              <div className="value-badge">
                <Flame className="w-3 h-3" />
                Value
              </div>
            )}
          </div>
        )}
      </Link>

      {/* Footer CTA */}
      <div className="px-4 pb-3">
        <Link
          to={`/match/${id}`}
          className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/50 hover:text-white/80 transition-all group"
        >
          Analyse complète
          <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </motion.div>
  );
}
