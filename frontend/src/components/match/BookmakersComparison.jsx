import { useState, useEffect, useMemo } from 'react';
import { oddsApi } from '../../services/api';
import { Spinner } from '../ui/Loading';
import { TrendingUp } from 'lucide-react';

// API-Football bet IDs
const BET_MATCH_WINNER = 1;
const BET_OVER_UNDER = 5;
const BET_BTTS = 8;

// Markets the user can compare across bookmakers. Each column maps a label to
// the API-Football `value` string for that selection.
function buildMarkets(homeTeam, awayTeam) {
  return {
    '1x2': {
      label: '1N2', betId: BET_MATCH_WINNER,
      cols: [
        { key: 'home', value: 'Home', label: homeTeam?.split(' ')[0] || '1', color: 'text-brand-400' },
        { key: 'draw', value: 'Draw', label: 'Nul', color: 'text-amber-400' },
        { key: 'away', value: 'Away', label: awayTeam?.split(' ')[0] || '2', color: 'text-blue-400' },
      ],
    },
    'ou25': {
      label: '+/- 2.5', betId: BET_OVER_UNDER,
      cols: [
        { key: 'over', value: 'Over 2.5', label: '+2.5', color: 'text-orange-400' },
        { key: 'under', value: 'Under 2.5', label: '-2.5', color: 'text-sky-400' },
      ],
    },
    'btts': {
      label: 'BTTS', betId: BET_BTTS,
      cols: [
        { key: 'yes', value: 'Yes', label: 'Oui', color: 'text-brand-400' },
        { key: 'no', value: 'No', label: 'Non', color: 'text-rose-400' },
      ],
    },
  };
}

export default function BookmakersComparison({ fixtureId, homeTeam, awayTeam }) {
  const [raw, setRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [market, setMarket] = useState('1x2');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const data = await oddsApi.getByFixture(fixtureId);
        if (!cancelled) setRaw(data?.response?.[0]?.bookmakers || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [fixtureId]);

  const markets = useMemo(() => buildMarkets(homeTeam, awayTeam), [homeTeam, awayTeam]);
  const cfg = markets[market];

  // Parse the selected market across bookmakers, sorted by lowest margin.
  const rows = useMemo(() => {
    return raw
      .map((bk) => {
        const bet = bk.bets?.find((b) => b.id === cfg.betId);
        if (!bet) return null;
        const odds = {};
        for (const col of cfg.cols) {
          const o = parseFloat(bet.values?.find((v) => v.value === col.value)?.odd);
          if (!o) return null;
          odds[col.key] = o;
        }
        const margin = (cfg.cols.reduce((s, c) => s + 1 / odds[c.key], 0) - 1) * 100;
        return { name: bk.name, odds, margin: parseFloat(margin.toFixed(1)) };
      })
      .filter(Boolean)
      .sort((a, b) => a.margin - b.margin);
  }, [raw, cfg]);

  const best = useMemo(() => {
    const b = {};
    for (const col of cfg.cols) b[col.key] = Math.max(0, ...rows.map((r) => r.odds[col.key]));
    return b;
  }, [rows, cfg]);

  const marketTabs = (
    <div className="flex gap-1.5">
      {Object.entries(markets).map(([k, m]) => (
        <button key={k} onClick={() => setMarket(k)}
          className={`px-3 py-1 rounded-lg text-xs font-heading font-bold transition-colors ${market === k ? 'bg-brand-500/20 text-brand-400 border border-brand-500/35' : 'text-white/40 border border-white/[0.08] hover:text-white/70'}`}>
          {m.label}
        </button>
      ))}
    </div>
  );

  if (loading) return <div className="flex justify-center py-8"><Spinner /></div>;
  if (error || raw.length === 0) return (
    <div className="glass-card p-8 text-center">
      <p className="text-3xl mb-2">📊</p>
      <p className="text-white/40 text-sm">Cotes bookmakers non disponibles</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {marketTabs}
        <span className="text-[11px] text-white/30">{rows.length} bookmakers</span>
      </div>

      {rows.length === 0 ? (
        <div className="glass-card p-6 text-center text-white/40 text-sm">Marché indisponible chez les bookmakers pour ce match.</div>
      ) : (
        <>
          {/* Best odds summary */}
          <div className={`grid gap-2 ${cfg.cols.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {cfg.cols.map((col) => (
              <div key={col.key} className="glass-card p-3 text-center">
                <p className="text-xs text-white/30 truncate">{col.label}</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <TrendingUp className={`w-3 h-3 ${col.color}`} />
                  <p className={`text-xl font-black ${col.color}`}>{best[col.key].toFixed(2)}</p>
                </div>
                <p className="text-[10px] text-white/20 mt-0.5">Meilleure cote</p>
              </div>
            ))}
          </div>

          {/* Bookmakers table */}
          <div className="glass-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/5 bg-white/3">
              <p className="text-xs font-bold text-white/50 uppercase tracking-wider">Comparaison — {cfg.label}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-xs text-white/30">
                    <th className="text-left px-4 py-2.5 font-medium">Bookmaker</th>
                    {cfg.cols.map((col) => (
                      <th key={col.key} className="text-center px-3 py-2.5 font-medium truncate max-w-[80px]">{col.label}</th>
                    ))}
                    <th className="text-center px-4 py-2.5 font-medium hidden sm:table-cell">Marge</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((bk) => (
                    <tr key={bk.name} className="border-b border-white/3 hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3 text-white/70 text-xs font-medium">{bk.name}</td>
                      {cfg.cols.map((col) => (
                        <OddCell key={col.key} value={bk.odds[col.key]} best={best[col.key]} color={col.color} />
                      ))}
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        <span className={`text-xs font-medium ${bk.margin < 5 ? 'text-green-400' : bk.margin < 8 ? 'text-white/50' : 'text-red-400'}`}>
                          {bk.margin}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-white/5">
              <p className="text-[10px] text-white/20">★ = meilleure cote. Marge = commission du bookmaker (plus elle est basse, mieux c'est).</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function OddCell({ value, best, color }) {
  const isBest = value === best;
  return (
    <td className={`px-3 py-3 text-center font-bold text-sm tabular-nums ${isBest ? color : 'text-white/50'}`}>
      {isBest && <span className="mr-0.5 text-[10px]">★</span>}
      {value.toFixed(2)}
    </td>
  );
}
