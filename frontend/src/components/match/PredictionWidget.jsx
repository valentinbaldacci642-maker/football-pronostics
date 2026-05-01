import { motion } from 'framer-motion';
import { TrendingUp, Target, Activity, BarChart2 } from 'lucide-react';
import { ConfidenceGauge, ProbabilityDonut } from './ProbabilityChart';
import { getConfidenceBg, getConfidenceLabel, outcomeColor } from '../../utils/probability';
import clsx from 'clsx';

function FormBadge({ result }) {
  return (
    <span className={clsx('w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold', outcomeColor(result))}>
      {result}
    </span>
  );
}

function StatComparison({ label, home, away }) {
  const total = home + away || 100;
  const homeW = (home / total) * 100;
  const awayW = (away / total) * 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-white/50">
        <span className="font-bold text-white/80">{home?.toFixed(0)}%</span>
        <span className="text-white/30">{label}</span>
        <span className="font-bold text-white/80">{away?.toFixed(0)}%</span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
        <div className="bg-brand-500/80 rounded-full transition-all duration-700" style={{ width: `${homeW}%` }} />
        <div className="flex-1 bg-blue-500/80 rounded-full" style={{ width: `${awayW}%` }} />
      </div>
    </div>
  );
}

function getRecOdd(rec, odds, homeTeam, awayTeam) {
  const advice = (rec?.advice || '').toLowerCase();
  const dc = odds?.doubleChance;
  const mw = odds?.matchWinner?.odds;

  // Double chance : parse which combo from advice text
  const isDoubleChance = advice.includes('double chance') || advice.includes(' or ');
  if (isDoubleChance && dc) {
    const hasHome = homeTeam && advice.includes(homeTeam.toLowerCase().substring(0, 4));
    const hasAway = awayTeam && advice.includes(awayTeam.toLowerCase().substring(0, 4));
    const hasDraw = advice.includes('draw') || advice.includes('nul');
    if (hasDraw && hasAway) return dc.drawAway?.odd;
    if (hasDraw && hasHome) return dc.homeDraw?.odd;
    if (hasHome && hasAway) return dc.homeAway?.odd;
  }

  // Simple 1X2
  if (!mw) return odds?.bestBet?.odd;
  const w = (rec?.winner || '').toLowerCase();
  if (w === 'draw') return mw.draw;
  if (homeTeam && w.includes(homeTeam.toLowerCase().substring(0, 4))) return mw.home;
  if (awayTeam && w.includes(awayTeam.toLowerCase().substring(0, 4))) return mw.away;
  return odds?.bestBet?.odd;
}

export default function PredictionWidget({ analysis, homeTeam, awayTeam }) {
  if (!analysis) return null;

  const { predictions, odds } = analysis;
  if (!predictions && !odds) return null;

  const probs = predictions?.probabilities;
  const rec = predictions?.recommendation;
  const form = predictions?.form;
  const comp = predictions?.goalsComparison;
  const xG = predictions?.expectedGoals;
  const bestBet = odds?.bestBet;
  const recOdd = rec ? getRecOdd(rec, odds, homeTeam, awayTeam) : null;

  return (
    <div className="space-y-4">
      {/* Main recommendation */}
      {rec?.advice && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-brand-500/10 border border-brand-500/25"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-gradient flex items-center justify-center flex-shrink-0">
              <Target className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-brand-400 font-semibold mb-0.5">Recommandation API</p>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm text-white/90">{rec.advice}</p>
                {recOdd && (
                  <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 font-black text-sm">
                    {recOdd.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Probability display */}
      {probs && (
        <div className="glass-card p-4">
          <h4 className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5" />
            Probabilités du match
          </h4>
          <ProbabilityDonut
            home={probs.home}
            draw={probs.draw}
            away={probs.away}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
          />

          {/* Probability bars */}
          <div className="mt-4 space-y-2.5">
            {[
              { label: homeTeam || 'Domicile', value: probs.home, color: 'bg-brand-500' },
              { label: 'Match nul', value: probs.draw, color: 'bg-amber-500' },
              { label: awayTeam || 'Extérieur', value: probs.away, color: 'bg-blue-500' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <span className="text-xs text-white/50 w-24 text-right truncate">{item.label}</span>
                <div className="flex-1 confidence-bar">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${item.value}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className={`h-full rounded-full ${item.color}`}
                  />
                </div>
                <span className={clsx('text-xs font-bold px-1.5 py-0.5 rounded-full', getConfidenceBg(item.value))}>
                  {item.value?.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* xG */}
      {xG && (
        <div className="glass-card p-4">
          <h4 className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-3">Expected Goals (xG)</h4>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-lg bg-brand-500/10">
              <p className="text-2xl font-black text-brand-400">{xG.home}</p>
              <p className="text-xs text-white/40">{homeTeam || 'Dom.'}</p>
            </div>
            <div className="p-3 rounded-lg bg-dark-700">
              <p className="text-2xl font-black text-white">{xG.total}</p>
              <p className="text-xs text-white/40">Total</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-500/10">
              <p className="text-2xl font-black text-blue-400">{xG.away}</p>
              <p className="text-xs text-white/40">{awayTeam || 'Ext.'}</p>
            </div>
          </div>
          <p className="text-xs text-white/30 text-center mt-2">
            {xG.total > 3 ? '🔥 Match ouvert — beaucoup de buts attendus' : xG.total > 2 ? '⚡ Match équilibré' : '🔒 Match serré — peu de buts'}
          </p>
        </div>
      )}

      {/* Comparison stats */}
      {comp && (
        <div className="glass-card p-4">
          <h4 className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-4">Comparaison des équipes</h4>
          <div className="flex items-center justify-between text-xs text-white/30 mb-3">
            <span className="font-semibold text-white/60 truncate max-w-[80px]">{homeTeam}</span>
            <span />
            <span className="font-semibold text-white/60 truncate max-w-[80px] text-right">{awayTeam}</span>
          </div>
          <div className="space-y-3">
            <StatComparison label="Attaque" home={comp.home?.attack} away={comp.away?.attack} />
            <StatComparison label="Défense" home={comp.home?.defense} away={comp.away?.defense} />
            <StatComparison label="Forme" home={comp.home?.form} away={comp.away?.form} />
          </div>
        </div>
      )}

      {/* Form */}
      {form && (form.home?.length > 0 || form.away?.length > 0) && (
        <div className="glass-card p-4">
          <h4 className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-3">Forme récente (5 derniers)</h4>
          <div className="space-y-3">
            {form.home?.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-white/40 w-20 text-right">{homeTeam}</span>
                <div className="flex gap-1">
                  {form.home.map((m, i) => <FormBadge key={i} result={m.result} />)}
                </div>
              </div>
            )}
            {form.away?.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-white/40 w-20 text-right">{awayTeam}</span>
                <div className="flex gap-1">
                  {form.away.map((m, i) => <FormBadge key={i} result={m.result} />)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Best bet highlight */}
      {bestBet && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 rounded-xl bg-gradient-to-r from-brand-500/20 to-brand-600/10 border border-brand-500/30"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-brand-400" />
            <span className="text-sm font-bold text-brand-300">Meilleur pari conseillé</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-white/40">{bestBet.market}</span>
              <p className="text-lg font-black text-white">{bestBet.selection}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-brand-400">{bestBet.odd?.toFixed(2)}</p>
              <span className={clsx('text-xs px-2 py-0.5 rounded-full font-semibold', getConfidenceBg(bestBet.prob))}>
                {bestBet.prob?.toFixed(0)}% · {getConfidenceLabel(bestBet.prob)}
              </span>
            </div>
          </div>
          {bestBet.confidence && (
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
              <ConfidenceGauge value={bestBet.prob} />
              <div>
                <p className="text-xs text-white/40">Indice de confiance</p>
                <p className="text-sm font-semibold" style={{ color: bestBet.confidence.color }}>
                  {bestBet.confidence.label}
                </p>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
