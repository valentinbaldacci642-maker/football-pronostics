import { useState, useEffect } from 'react';
import { oddsApi } from '../../services/api';
import { Spinner } from '../ui/Loading';
import { TrendingUp } from 'lucide-react';

const MATCH_WINNER_BET_ID = 1;
const TOP_BOOKMAKERS = ['Bet365', 'Unibet', 'Bwin', 'William Hill', 'Betclic', 'Winamax', 'PMU', '1xBet', 'Betway', 'Pinnacle'];

export default function BookmakersComparison({ fixtureId, homeTeam, awayTeam }) {
  const [bookmakers, setBookmakers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await oddsApi.getByFixture(fixtureId);
        const raw = data?.response?.[0]?.bookmakers || [];
        const parsed = raw
          .map((bk) => {
            const mw = bk.bets?.find((b) => b.id === MATCH_WINNER_BET_ID);
            if (!mw) return null;
            const home = parseFloat(mw.values?.find((v) => v.value === 'Home')?.odd);
            const draw = parseFloat(mw.values?.find((v) => v.value === 'Draw')?.odd);
            const away = parseFloat(mw.values?.find((v) => v.value === 'Away')?.odd);
            if (!home || !draw || !away) return null;
            const margin = ((1/home + 1/draw + 1/away - 1) * 100);
            return { name: bk.name, home, draw, away, margin: parseFloat(margin.toFixed(1)) };
          })
          .filter(Boolean)
          .sort((a, b) => a.margin - b.margin);
        setBookmakers(parsed);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [fixtureId]);

  if (loading) return <div className="flex justify-center py-8"><Spinner /></div>;

  if (error || bookmakers.length === 0) return (
    <div className="glass-card p-8 text-center">
      <p className="text-3xl mb-2">📊</p>
      <p className="text-white/40 text-sm">Cotes bookmakers non disponibles</p>
    </div>
  );

  const bestHome = Math.max(...bookmakers.map(b => b.home));
  const bestDraw = Math.max(...bookmakers.map(b => b.draw));
  const bestAway = Math.max(...bookmakers.map(b => b.away));

  return (
    <div className="space-y-3">
      {/* Best odds summary */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: homeTeam || 'Domicile', best: bestHome, color: 'text-brand-400' },
          { label: 'Nul', best: bestDraw, color: 'text-amber-400' },
          { label: awayTeam || 'Extérieur', best: bestAway, color: 'text-blue-400' },
        ].map(({ label, best, color }) => (
          <div key={label} className="glass-card p-3 text-center">
            <p className="text-xs text-white/30 truncate">{label}</p>
            <div className="flex items-center justify-center gap-1 mt-1">
              <TrendingUp className={`w-3 h-3 ${color}`} />
              <p className={`text-xl font-black ${color}`}>{best.toFixed(2)}</p>
            </div>
            <p className="text-[10px] text-white/20 mt-0.5">Meilleure cote</p>
          </div>
        ))}
      </div>

      {/* Bookmakers table */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/5 bg-white/3">
          <p className="text-xs font-bold text-white/50 uppercase tracking-wider">Comparaison — {bookmakers.length} bookmakers</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-xs text-white/30">
                <th className="text-left px-4 py-2.5 font-medium">Bookmaker</th>
                <th className="text-center px-3 py-2.5 font-medium truncate max-w-[80px]">{homeTeam?.split(' ')[0] || '1'}</th>
                <th className="text-center px-3 py-2.5 font-medium">Nul</th>
                <th className="text-center px-3 py-2.5 font-medium truncate max-w-[80px]">{awayTeam?.split(' ')[0] || '2'}</th>
                <th className="text-center px-4 py-2.5 font-medium hidden sm:table-cell">Marge</th>
              </tr>
            </thead>
            <tbody>
              {bookmakers.map((bk) => (
                <tr key={bk.name} className="border-b border-white/3 hover:bg-white/3 transition-colors">
                  <td className="px-4 py-3 text-white/70 text-xs font-medium">{bk.name}</td>
                  <OddCell value={bk.home} best={bestHome} color="text-brand-400" />
                  <OddCell value={bk.draw} best={bestDraw} color="text-amber-400" />
                  <OddCell value={bk.away} best={bestAway} color="text-blue-400" />
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
          <p className="text-[10px] text-white/20">Marge = commission du bookmaker. Plus elle est basse, meilleures sont les cotes.</p>
        </div>
      </div>
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
