import { motion } from 'framer-motion';
import { TrendingUp, AlertTriangle, Flame } from 'lucide-react';
import { getConfidenceBg, formatOdd } from '../../utils/probability';
import clsx from 'clsx';

function OddsCell({ label, odd, fairProb, valueInfo, kelly }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={clsx(
        'flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all cursor-pointer',
        valueInfo?.isValue
          ? 'bg-gold-500/10 border-gold-500/30 hover:bg-gold-500/15'
          : 'bg-dark-700/50 border-white/5 hover:bg-dark-700 hover:border-white/10'
      )}
    >
      <span className="text-xs text-white/40 font-medium">{label}</span>
      <span className={clsx('text-xl font-black', valueInfo?.isValue ? 'text-gold-400' : 'text-white')}>
        {formatOdd(odd)}
      </span>
      {fairProb !== undefined && (
        <span className={clsx('text-xs px-1.5 py-0.5 rounded-full', getConfidenceBg(fairProb))}>
          {fairProb?.toFixed(0)}%
        </span>
      )}
      {valueInfo?.isValue && (
        <div className="flex items-center gap-1 text-gold-400">
          <Flame className="w-3 h-3" />
          <span className="text-xs font-bold">+{valueInfo.edge?.toFixed(1)}%</span>
        </div>
      )}
      {kelly > 0 && (
        <span className="text-xs text-white/25">Kelly: {kelly?.toFixed(1)}%</span>
      )}
    </motion.div>
  );
}

export function MatchWinnerOdds({ data }) {
  if (!data) return null;
  const { odds, fairProbs, valueBets, kelly } = data;

  return (
    <div>
      <h4 className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-3">Résultat final — 1X2</h4>
      <div className="flex gap-2">
        <OddsCell
          label="Victoire 1"
          odd={odds.home}
          fairProb={fairProbs.home}
          valueInfo={valueBets?.home}
          kelly={kelly?.home}
        />
        <OddsCell
          label="Nul X"
          odd={odds.draw}
          fairProb={fairProbs.draw}
          valueInfo={valueBets?.draw}
          kelly={kelly?.draw}
        />
        <OddsCell
          label="Victoire 2"
          odd={odds.away}
          fairProb={fairProbs.away}
          valueInfo={valueBets?.away}
          kelly={kelly?.away}
        />
      </div>
      {data.overround && (
        <p className="text-xs text-white/25 mt-2 text-right">Marge bookmaker: {data.overround}%</p>
      )}
    </div>
  );
}

export function OverUnderOdds({ data }) {
  if (!data?.lines) return null;
  const lines = data.lines;

  return (
    <div>
      <h4 className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-3">Buts — Over / Under</h4>
      <div className="space-y-2">
        {['1.5', '2.5', '3.5'].map((line) => {
          if (!lines[line]) return null;
          const { over, under } = lines[line];
          return (
            <div key={line} className="flex items-center gap-2">
              <span className="text-xs text-white/30 w-8 font-mono">{line}</span>
              <div className="flex-1 flex gap-2">
                {over && (
                  <div className={clsx(
                    'flex-1 flex items-center justify-between px-3 py-2 rounded-lg border text-xs',
                    over.valueInfo?.isValue ? 'bg-gold-500/10 border-gold-500/30 text-gold-300' : 'bg-dark-700 border-white/5 text-white/70'
                  )}>
                    <span>Over</span>
                    <span className="font-bold">{formatOdd(over.odd)}</span>
                    <span className="text-white/40">{(over.fairProb || over.impliedProb)?.toFixed(0)}%</span>
                  </div>
                )}
                {under && (
                  <div className={clsx(
                    'flex-1 flex items-center justify-between px-3 py-2 rounded-lg border text-xs',
                    under.valueInfo?.isValue ? 'bg-gold-500/10 border-gold-500/30 text-gold-300' : 'bg-dark-700 border-white/5 text-white/70'
                  )}>
                    <span>Under</span>
                    <span className="font-bold">{formatOdd(under.odd)}</span>
                    <span className="text-white/40">{(under.fairProb || under.impliedProb)?.toFixed(0)}%</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BTTSOdds({ data }) {
  if (!data) return null;
  const { odds, fairProbs, valueBets } = data;

  return (
    <div>
      <h4 className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-3">Les deux équipes marquent (BTTS)</h4>
      <div className="flex gap-2">
        <OddsCell label="Oui" odd={odds.yes} fairProb={fairProbs.yes} valueInfo={valueBets?.yes} />
        <OddsCell label="Non" odd={odds.no} fairProb={fairProbs.no} valueInfo={valueBets?.no} />
      </div>
    </div>
  );
}

export function ExactScoreOdds({ data }) {
  if (!data?.length) return null;
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs text-white/40 font-semibold uppercase tracking-wider">Score exact — Cotes bookmakers</h4>
        <span className="text-xs text-white/20 italic">prob. implicite bookmaker</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {data.slice(0, 6).map((item, i) => (
          <div key={i} className={clsx(
            'flex flex-col gap-0.5 px-3 py-2 rounded-lg border text-xs',
            i === 0 ? 'bg-brand-500/15 border-brand-500/30' : 'bg-dark-700 border-white/5'
          )}>
            <div className="flex items-center justify-between">
              <span className={clsx('font-bold font-mono text-sm', i === 0 ? 'text-brand-400' : 'text-white')}>{item.score}</span>
              <span className={clsx('font-bold', i === 0 ? 'text-brand-300' : 'text-white/60')}>{formatOdd(item.odd)}</span>
            </div>
            <span className="text-white/30">{item.prob?.toFixed(1)}% (bookmaker)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HandicapOdds({ data }) {
  if (!data || !Array.isArray(data) || data.length === 0) return null;
  // data = [{ outcome, odd, prob }] from _analyzeHandicap
  const sorted = [...data].sort((a, b) => (b.prob || 0) - (a.prob || 0)).slice(0, 8);
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs text-white/40 font-semibold uppercase tracking-wider">Handicap asiatique</h4>
        <span className="text-xs text-white/20 italic">prob. implicite</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {sorted.map((item, i) => (
          <div key={i} className={clsx(
            'flex flex-col gap-0.5 px-3 py-2 rounded-lg border text-xs',
            i === 0 ? 'bg-brand-500/10 border-brand-500/25' : 'bg-dark-700 border-white/5'
          )}>
            <div className="flex items-center justify-between gap-1">
              <span className={clsx('font-bold font-mono text-xs truncate', i === 0 ? 'text-brand-300' : 'text-white/80')}>
                {item.outcome}
              </span>
              <span className={clsx('font-bold flex-shrink-0', i === 0 ? 'text-brand-400' : 'text-white/60')}>
                {formatOdd(item.odd)}
              </span>
            </div>
            <span className="text-white/30 font-mono text-[10px]">{item.prob?.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ValueBetsList({ valueBets }) {
  if (!valueBets?.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl bg-gold-500/10 border border-gold-500/25"
    >
      <div className="flex items-center gap-2 mb-3">
        <Flame className="w-4 h-4 text-gold-400" />
        <h4 className="text-sm font-bold text-gold-400">Value Bets Détectés</h4>
      </div>
      <div className="space-y-2">
        {valueBets.map((vb, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span className="text-white/70">{vb.market} — <span className="font-semibold text-white">{vb.selection}</span></span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-gold-300">{formatOdd(vb.odd)}</span>
              <span className={clsx('text-xs px-1.5 py-0.5 rounded-full', getConfidenceBg(vb.trueProb))}>
                {vb.trueProb?.toFixed(0)}%
              </span>
              <span className="text-xs text-green-400 font-bold">+{vb.edge?.toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
