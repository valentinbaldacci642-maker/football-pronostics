import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Star, TrendingUp, Flame, ChevronRight } from 'lucide-react';
import { useFavoritesStore } from '../../store';
import { formatTime, getMatchStatus, getScoreDisplay } from '../../utils/format';
import { getConfidenceBg } from '../../utils/probability';
import clsx from 'clsx';

function TeamLogo({ logo, name }) {
  return (
    <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
      <div className="w-12 h-12 rounded-xl bg-dark-700/80 flex items-center justify-center p-1.5 flex-shrink-0">
        <img
          src={logo}
          alt={name}
          className="w-full h-full object-contain"
          onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
        />
        <div className="hidden w-full h-full items-center justify-center text-base font-display text-white/30">
          {name?.charAt(0)}
        </div>
      </div>
      <p className="text-xs font-heading font-semibold text-white/70 text-center leading-tight line-clamp-2 max-w-[80px]">{name}</p>
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
  const isLive = status.type === 'live';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        'football-card overflow-hidden',
        isLive && 'border-danger/20'
      )}
    >
      {/* League header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          {league?.logo && <img src={league.logo} alt={league.name} className="w-3.5 h-3.5 object-contain opacity-80" />}
          <span className="text-xs text-white/35 font-heading font-medium truncate max-w-[160px]">{league?.name}</span>
          {league?.round && <span className="text-xs text-white/15">· {league.round}</span>}
        </div>
        <div className="flex items-center gap-2">
          {isLive ? (
            <div className="live-indicator">
              <span className="w-1.5 h-1.5 rounded-full bg-danger animate-live-dot" />
              {fix?.status?.short === 'HT'
                ? 'MT'
                : fix?.status?.elapsed ? `${fix.status.elapsed}'` : 'LIVE'}
            </div>
          ) : (
            <span className={clsx(
              'text-xs font-heading font-semibold px-2 py-0.5 rounded-lg',
              status.type === 'finished' ? 'text-white/25 bg-white/[0.04]' : 'text-brand-400'
            )}>
              {status.type === 'scheduled' ? formatTime(fix?.date) : status.label}
            </span>
          )}
          <button
            onClick={(e) => { e.preventDefault(); toggle(id); }}
            className={clsx('p-1 rounded-lg transition-all', isFav ? 'text-gold-400' : 'text-white/15 hover:text-white/50')}
          >
            <Star className="w-3.5 h-3.5" fill={isFav ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      {/* Match body */}
      <Link to={`/match/${id}`} className="block px-4 py-4 cursor-pointer">
        <div className="flex items-center gap-3">
          <TeamLogo logo={home?.logo} name={home?.name} />

          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            {score ? (
              <div className="flex items-center gap-2">
                <span className="score-display text-3xl tabular-nums">{score.home}</span>
                <span className="text-white/20 text-sm font-display">:</span>
                <span className="score-display text-3xl tabular-nums">{score.away}</span>
              </div>
            ) : (
              <span className="matchup-vs">VS</span>
            )}
            {fix?.venue?.city && (
              <span className="text-[10px] text-white/20 font-heading truncate max-w-[80px]">{fix.venue.city}</span>
            )}
          </div>

          <TeamLogo logo={away?.logo} name={away?.name} />
        </div>

        {/* Prediction bar */}
        {prob && (
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-xs text-white/30 font-mono">
              <span>1 — {prob.home?.toFixed(0)}%</span>
              <span>X — {prob.draw?.toFixed(0)}%</span>
              <span>2 — {prob.away?.toFixed(0)}%</span>
            </div>
            <div className="flex h-1 rounded-full overflow-hidden gap-px">
              <div className="rounded-l-full transition-all duration-700" style={{ background: 'linear-gradient(90deg, #22c55e, #4ade80)', width: `${prob.home}%` }} />
              <div className="bg-gold-500/50 transition-all duration-700" style={{ width: `${prob.draw}%` }} />
              <div className="rounded-r-full bg-info/50 flex-1" />
            </div>
          </div>
        )}

        {/* Best bet */}
        {bestBet && (
          <div className="mt-3 flex items-center gap-2">
            <div className={clsx('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-heading font-semibold', getConfidenceBg(bestBet.prob))}>
              <TrendingUp className="w-3 h-3" />
              <span>{bestBet.market}: {bestBet.selection}</span>
              <span className="opacity-60 font-mono">@ {bestBet.odd?.toFixed(2)}</span>
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

      {/* Footer */}
      <div className="px-4 pb-3">
        <Link
          to={`/match/${id}`}
          className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs text-white/35 hover:text-white/70 font-heading font-medium transition-all group"
        >
          Analyse complète
          <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </motion.div>
  );
}
