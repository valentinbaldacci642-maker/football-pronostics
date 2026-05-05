import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, RefreshCw } from 'lucide-react';
import { oddsApi } from '../../services/api';
import clsx from 'clsx';

const LIVE_STATUSES = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE'];

/**
 * Pull live odds for a fixture and surface the current 1X2 prices.
 * Polls every 30 s while the match is in progress so users can spot
 * value bets that emerge mid-match (e.g. Over 2.5 cote climbs at HT 0-0).
 */
export default function LiveOddsBanner({ fixtureId, fixtureStatus }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState(null);

  const isLive = LIVE_STATUSES.includes(fixtureStatus);

  useEffect(() => {
    if (!isLive || !fixtureId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await oddsApi.getLive(fixtureId);
        if (cancelled) return;
        const liveOdds = res?.response?.[0];
        setData(liveOdds || null);
        setLastFetch(new Date());
      } catch {
        // silently ignore — no live odds = nothing to show
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [fixtureId, isLive]);

  if (!isLive) return null;

  // Find the 1X2 market in the live odds payload
  const matchWinnerBet = data?.odds?.find((o) =>
    /match.?winner|1x2|full.?time/i.test(o.name || '')
  );
  const values = matchWinnerBet?.values || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4 border-l-4 border-red-500 bg-red-500/[0.04]"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          <h4 className="text-xs text-red-400 font-heading font-bold uppercase tracking-wider">
            Cotes en direct
          </h4>
          <span className="text-[10px] text-white/40 font-mono">{fixtureStatus}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-white/30 font-mono">
          {loading && <RefreshCw className="w-3 h-3 animate-spin" />}
          {lastFetch && !loading && (
            <span>maj {Math.round((Date.now() - lastFetch.getTime()) / 1000)}s</span>
          )}
        </div>
      </div>

      {values.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {values.map((v, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5 p-2 rounded-lg bg-dark-800 border border-white/5">
              <span className="text-[10px] text-white/40 uppercase font-heading">{v.value}</span>
              <span className="text-lg font-display tracking-wider text-white">{v.odd}</span>
              <span className="text-[10px] text-white/30 font-mono">
                {(100 / parseFloat(v.odd || 1)).toFixed(0)}% impl.
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-white/40 italic">
          {loading ? 'Chargement des cotes en direct...' : 'Aucune cote live disponible pour ce match'}
        </p>
      )}

      <p className="text-[10px] text-white/30 mt-3 font-heading">
        ⚡ Mise à jour automatique toutes les 30 secondes pendant que le match est en cours
      </p>
    </motion.div>
  );
}
