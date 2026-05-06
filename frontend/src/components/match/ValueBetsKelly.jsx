import { motion } from 'framer-motion';
import { Flame, AlertTriangle } from 'lucide-react';
import { useBankrollStore, useHistoryStore } from '../../store';
import { kellyStake } from '../../utils/kelly';
import { formatStake } from '../../utils/formatStake';
import ValueBetSources from './ValueBetSources';

/**
 * Surfaces all detected value bets on a match with their Kelly stake in €.
 * Mirrors the home-card 'Value bets à parier' block but for the match detail
 * page. Reads bankroll dispo + Kelly fraction from the bankroll store.
 */
export default function ValueBetsKelly({ valueBets }) {
  const { initialBankroll, kellyFraction: kFrac } = useBankrollStore();
  const stats = useHistoryStore((s) => s.getBankrollStats());
  const liveBankroll = initialBankroll + (stats.pnl || 0) - (stats.pendingCommitted || 0);

  if (!valueBets?.length) {
    return (
      <div className="glass-card p-4 border-l-4 border-white/[0.08] bg-white/[0.02]">
        <div className="flex items-center gap-2 text-white/40">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-xs font-heading">Aucun value bet détecté sur ce match</span>
        </div>
        <p className="text-[11px] text-white/25 mt-1">
          Pas de pari conseillé. Le bookie a bien évalué tous les marchés analysés.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4 border-l-4 border-gold-500 bg-gold-500/[0.04]"
    >
      <div className="flex items-center gap-2 mb-3">
        <Flame className="w-4 h-4 text-gold-400" />
        <h4 className="text-sm font-heading font-bold text-gold-400 uppercase tracking-wider">
          Value bets à parier
        </h4>
      </div>

      <div className="space-y-2">
        {valueBets.map((vb, i) => {
          const prob = vb.trueProb ?? vb.prob;
          const stake = (vb.odd && prob) ? kellyStake(prob, vb.odd, liveBankroll, kFrac) : 0;
          return (
            <div
              key={i}
              className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gold-500/[0.08] border border-gold-500/30"
            >
              <span className="text-xs font-display tracking-wider text-gold-400 bg-gold-400/10 px-1.5 py-0.5 rounded leading-none">
                +{vb.edge?.toFixed(1)}%
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-xs text-white/40 font-heading">{vb.market}</p>
                  <ValueBetSources sources={vb.sources} />
                </div>
                <p className="text-sm font-heading font-bold text-white truncate">{vb.selection}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-base font-display tracking-wider text-gold-400">@{vb.odd?.toFixed(2)}</p>
                {stake > 0 ? (
                  <p className="text-xs text-gold-400/90 font-display tracking-wider mt-0.5">
                    Mise: {formatStake(stake)}
                  </p>
                ) : liveBankroll <= 0 ? (
                  <p className="text-[10px] text-white/30 font-heading mt-0.5">
                    Définir bankroll
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {liveBankroll <= 0 && (
        <p className="text-[10px] text-white/40 italic mt-2">
          ℹ️ Bankroll non définie. Va dans Historique → Bankroll pour la régler et voir les mises Kelly.
        </p>
      )}
    </motion.div>
  );
}
