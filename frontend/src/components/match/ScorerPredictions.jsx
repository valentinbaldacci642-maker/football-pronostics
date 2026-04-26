import { motion } from 'framer-motion';
import { Target, TrendingUp, Zap, User } from 'lucide-react';
import { getConfidenceColor } from '../../utils/probability';
import clsx from 'clsx';

function ScorerBar({ probability, color }) {
  return (
    <div className="h-1 rounded-full bg-dark-600 overflow-hidden flex-1">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(probability, 100)}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="h-full rounded-full"
        style={{ background: color }}
      />
    </div>
  );
}

function ScorerRow({ player, rank, homeColor }) {
  const color = getConfidenceColor(player.probability);
  const isLiveScorer = player.liveGoals > 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.04 }}
      className={clsx(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors',
        isLiveScorer
          ? 'bg-green-500/10 border border-green-500/25'
          : rank === 0
          ? 'bg-white/5'
          : 'hover:bg-white/3'
      )}
    >
      {/* Rang */}
      <span className={clsx(
        'w-5 text-center text-xs font-black flex-shrink-0',
        rank === 0 ? 'text-gold-400' : rank === 1 ? 'text-white/50' : 'text-white/25'
      )}>
        {rank + 1}
      </span>

      {/* Photo joueur */}
      <div className="w-8 h-8 rounded-full bg-dark-600 overflow-hidden flex-shrink-0 border border-white/5">
        {player.photo ? (
          <img
            src={player.photo}
            alt={player.name}
            className="w-full h-full object-cover"
            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
          />
        ) : null}
        <div className={clsx(
          'w-full h-full items-center justify-center text-xs text-white/30',
          player.photo ? 'hidden' : 'flex'
        )}>
          <User className="w-4 h-4" />
        </div>
      </div>

      {/* Nom + barre */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={clsx(
            'text-sm font-semibold truncate',
            isLiveScorer ? 'text-green-300' : 'text-white/90'
          )}>
            {player.name}
          </span>
          {isLiveScorer && (
            <span className="flex items-center gap-1 text-xs font-bold text-green-400 bg-green-500/15 px-1.5 py-0.5 rounded-full flex-shrink-0">
              <Zap className="w-2.5 h-2.5" />
              {player.liveGoals} but{player.liveGoals > 1 ? 's' : ''}
            </span>
          )}
          {!player.isStarting && !isLiveScorer && (
            <span className="text-xs text-white/20 flex-shrink-0">remplaçant</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <ScorerBar probability={player.probability} color={color} />
          <span className="text-xs font-bold flex-shrink-0" style={{ color }}>
            {player.probability}%
          </span>
        </div>
      </div>

      {/* Stats saison */}
      {player.seasonGoals > 0 && (
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-black text-white">{player.seasonGoals}</p>
          <p className="text-xs text-white/25">buts</p>
        </div>
      )}
    </motion.div>
  );
}

function TeamScorers({ side, data }) {
  if (!data?.scorers?.length) return (
    <div className="text-center py-6 text-white/25 text-sm">
      Données insuffisantes
    </div>
  );

  return (
    <div className="space-y-1">
      {data.scorers.map((player, i) => (
        <ScorerRow key={player.id ?? i} player={player} rank={i} />
      ))}
    </div>
  );
}

export default function ScorerPredictions({ data, loading, error }) {
  if (loading) {
    return (
      <div className="glass-card p-4 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="w-5 h-3 bg-white/5 rounded" />
            <div className="w-8 h-8 rounded-full bg-white/5" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-28 bg-white/5 rounded" />
              <div className="h-1 bg-white/5 rounded-full" />
            </div>
            <div className="w-6 h-5 bg-white/5 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-white/30 text-sm">Données buteurs non disponibles</p>
        <p className="text-white/15 text-xs mt-1">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { home, away, liveStats, season } = data;

  return (
    <div className="space-y-4">
      {/* Header info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-brand-400" />
          <span className="text-sm font-bold text-white/80">Pronostics Buteurs</span>
        </div>
        <div className="flex items-center gap-2">
          {liveStats && (
            <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-full">
              <Zap className="w-3 h-3" />
              Stats live
            </span>
          )}
          <span className="text-xs text-white/20">Saison {season}</span>
        </div>
      </div>

      {/* Méthode */}
      <div className="px-3 py-2 rounded-lg bg-dark-700/50 border border-white/5">
        <p className="text-xs text-white/30">
          <span className="text-white/50 font-medium">Méthode :</span> Probabilité Poisson par joueur basée sur le ratio buts/match et les xG du match. Données: top scorers de la ligue + compositions.
        </p>
      </div>

      {/* Deux colonnes */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Équipe domicile */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/5">
            {home.team?.logo && (
              <img src={home.team.logo} alt="" className="w-5 h-5 object-contain" />
            )}
            <span className="text-sm font-bold text-white truncate">{home.team?.name}</span>
            <span className="ml-auto text-xs font-mono text-brand-400 flex-shrink-0">
              xG {home.xG}
            </span>
          </div>
          <TeamScorers side="home" data={home} />
        </div>

        {/* Équipe extérieur */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/5">
            {away.team?.logo && (
              <img src={away.team.logo} alt="" className="w-5 h-5 object-contain" />
            )}
            <span className="text-sm font-bold text-white truncate">{away.team?.name}</span>
            <span className="ml-auto text-xs font-mono text-blue-400 flex-shrink-0">
              xG {away.xG}
            </span>
          </div>
          <TeamScorers side="away" data={away} />
        </div>
      </div>

      {/* Top buteurs combiné */}
      <div className="glass-card p-4">
        <h4 className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5" />
          Top 5 buteurs probables (toutes équipes)
        </h4>
        <div className="space-y-1">
          {[...home.scorers, ...away.scorers]
            .sort((a, b) => b.probability - a.probability)
            .slice(0, 5)
            .map((player, i) => {
              const isHome = home.scorers.some(p => p.id === player.id);
              return (
                <div key={player.id ?? i} className="flex items-center gap-3 py-2">
                  <span className={clsx(
                    'text-xs font-black w-4 text-center',
                    i === 0 ? 'text-gold-400' : 'text-white/30'
                  )}>{i + 1}</span>
                  <div className="w-7 h-7 rounded-full bg-dark-600 overflow-hidden flex-shrink-0">
                    <img src={player.photo} alt="" className="w-full h-full object-cover"
                      onError={(e) => e.target.style.display = 'none'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white/80 font-medium truncate block">{player.name}</span>
                    <span className={clsx(
                      'text-xs',
                      isHome ? 'text-brand-400/60' : 'text-blue-400/60'
                    )}>
                      {isHome ? home.team?.name : away.team?.name}
                    </span>
                  </div>
                  {player.seasonGoals > 0 && (
                    <span className="text-xs text-white/30 flex-shrink-0">{player.seasonGoals} buts</span>
                  )}
                  <span
                    className="text-sm font-black flex-shrink-0"
                    style={{ color: getConfidenceColor(player.probability) }}
                  >
                    {player.probability}%
                  </span>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
