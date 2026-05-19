import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import clsx from 'clsx';
import { useFavoritesStore } from '../../store';
import { formatTime, getMatchStatus, getScoreDisplay } from '../../utils/format';

/**
 * Flashscore-style single-line match row. Optimised for high density —
 * pairs nicely with LeagueGroup which renders one block per league.
 *
 * Layout:
 *   [★] [hh:mm or status] [logo + home team][score]
 *                          [logo + away team][score]   [LIVE chip if live]
 *
 * The two team lines share the same time/star cell on the left so the
 * row reads as ONE match without forcing an extra column for the dash.
 */
export default function MatchRow({ fixture }) {
  const { toggle, isFavorite } = useFavoritesStore();
  const { teams, fixture: fix } = fixture;
  const home = teams?.home;
  const away = teams?.away;
  const id = fix?.id;
  const status = getMatchStatus(fixture);
  const score = getScoreDisplay(fixture);
  const isFav = isFavorite(id);
  const isLive = status.type === 'live';
  const isFinished = status.type === 'finished';
  const isScheduled = status.type === 'scheduled';

  const homeWon = score && score.home > score.away;
  const awayWon = score && score.away > score.home;

  // Left column shows the kickoff time for scheduled/finished, or the
  // running clock for live. Falls back to status code if unavailable.
  let leftLabel;
  if (isLive) {
    leftLabel = fix?.status?.short === 'HT'
      ? 'MT'
      : fix?.status?.elapsed != null ? `${fix.status.elapsed}'` : 'LIVE';
  } else if (isScheduled) {
    leftLabel = formatTime(fix?.date);
  } else if (isFinished) {
    leftLabel = formatTime(fix?.date);
  } else {
    leftLabel = status.label || '—';
  }

  return (
    <Link
      to={`/match/${id}`}
      className={clsx(
        'group flex items-stretch border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors',
        isLive && 'bg-danger/[0.03]'
      )}
    >
      {/* Favorite star + time column */}
      <div className="flex items-center gap-2 pl-3 pr-3 py-2 flex-shrink-0 w-[88px]">
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(id); }}
          className={clsx(
            'p-0.5 rounded transition-colors',
            isFav ? 'text-gold-400' : 'text-white/15 hover:text-white/50'
          )}
          title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        >
          <Star className="w-3.5 h-3.5" fill={isFav ? 'currentColor' : 'none'} />
        </button>
        <span className={clsx(
          'text-xs font-mono tabular-nums',
          isLive ? 'text-danger font-bold' : isFinished ? 'text-white/30' : 'text-white/55'
        )}>
          {leftLabel}
        </span>
      </div>

      {/* Two team rows stacked. Each line: logo + name on left, score on right. */}
      <div className="flex-1 min-w-0 py-1.5 pr-3">
        <TeamLine team={home} winning={homeWon} score={score?.home} hasScore={!!score} dim={isFinished && awayWon} />
        <TeamLine team={away} winning={awayWon} score={score?.away} hasScore={!!score} dim={isFinished && homeWon} />
      </div>

      {/* Status chip column (right edge). Visible only for live matches; the
          time is already in the left column for scheduled/finished. */}
      <div className="flex items-center pr-3 py-2 flex-shrink-0">
        {isLive && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-heading font-bold bg-danger/15 text-danger">
            <span className="w-1.5 h-1.5 rounded-full bg-danger animate-live-dot" />
            LIVE
          </span>
        )}
      </div>
    </Link>
  );
}

function TeamLine({ team, winning, score, hasScore, dim }) {
  return (
    <div className={clsx('flex items-center gap-2 py-0.5 min-w-0', dim && 'opacity-50')}>
      <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
        {team?.logo ? (
          <img
            src={team.logo}
            alt=""
            className="w-full h-full object-contain"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <span className="text-[10px] text-white/30">⚽</span>
        )}
      </div>
      <span className={clsx(
        'text-sm font-heading truncate flex-1 min-w-0',
        winning ? 'text-white font-semibold' : 'text-white/75'
      )}>
        {team?.name || '—'}
      </span>
      <span className={clsx(
        'text-sm font-mono tabular-nums w-6 text-right flex-shrink-0',
        hasScore
          ? winning ? 'text-white font-bold' : 'text-white/55'
          : 'text-white/15'
      )}>
        {hasScore ? score : '-'}
      </span>
    </div>
  );
}
