import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart2 } from 'lucide-react';
import { leaguesApi } from '../../services/api';

function FormDots({ form }) {
  if (!form) return null;
  return (
    <div className="flex gap-0.5 justify-end">
      {form.slice(-5).split('').map((c, i) => (
        <span
          key={i}
          className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center text-[8px] font-bold leading-none ${
            c === 'W' ? 'bg-brand-500/30 text-brand-300' :
            c === 'D' ? 'bg-white/10 text-white/60' :
            c === 'L' ? 'bg-danger/30 text-red-300' : 'bg-white/5 text-white/30'
          }`}
        >
          {c}
        </span>
      ))}
    </div>
  );
}

/**
 * Compact league-position card for the match detail page: shows the two
 * teams' standings rows (rank, played, goal diff, points, recent form),
 * highlighting each. Renders nothing for competitions without standings
 * (most cups) or when the data isn't available.
 */
export default function MiniStandings({ leagueId, season, homeId, awayId, leagueName }) {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leagueId || !season) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    leaguesApi.getStandings(leagueId, season)
      .then((data) => {
        if (cancelled) return;
        // standings = array of groups (each an array of team rows).
        const groups = data?.response?.[0]?.league?.standings || [];
        const flat = groups.flat();
        const home = flat.find((r) => r.team?.id === homeId) || null;
        const away = flat.find((r) => r.team?.id === awayId) || null;
        setRows(home || away ? { home, away, total: flat.length } : null);
      })
      .catch(() => { if (!cancelled) setRows(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [leagueId, season, homeId, awayId]);

  if (loading) {
    return <div className="glass-card p-4"><div className="h-20 skeleton rounded-lg" /></div>;
  }
  if (!rows || (!rows.home && !rows.away)) return null;

  const Row = ({ r, highlight }) => {
    if (!r) return null;
    return (
      <Link
        to={`/team/${r.team.id}`}
        className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-colors"
      >
        <span className="w-6 text-center font-mono text-xs text-white/40 flex-shrink-0">{r.rank}</span>
        <img src={r.team.logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" onError={(e) => e.target.style.display = 'none'} />
        <span className={`text-sm font-heading truncate flex-1 min-w-0 ${highlight ? 'text-white font-semibold' : 'text-white/75'}`}>
          {r.team.name}
        </span>
        <FormDots form={r.form} />
        <span className="text-xs font-mono text-white/40 w-9 text-right flex-shrink-0 hidden sm:block">
          {r.goalsDiff > 0 ? `+${r.goalsDiff}` : r.goalsDiff}
        </span>
        <span className="text-sm font-display text-white w-7 text-right flex-shrink-0">{r.points}</span>
      </Link>
    );
  };

  return (
    <div className="glass-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.05]">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-brand-400" />
          <span className="text-sm font-heading font-semibold text-white/70">Classement</span>
        </div>
        {leagueName && <span className="text-xs text-white/30 truncate max-w-[160px]">{leagueName}</span>}
      </div>
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.04] text-[10px] font-heading font-semibold uppercase tracking-wider text-white/25">
        <span className="w-6 text-center flex-shrink-0">#</span>
        <span className="w-5 flex-shrink-0" />
        <span className="flex-1">Équipe</span>
        <span>Forme</span>
        <span className="w-9 text-right flex-shrink-0 hidden sm:block">Diff</span>
        <span className="w-7 text-right flex-shrink-0">Pts</span>
      </div>
      <div className="py-1">
        <Row r={rows.home} highlight />
        <Row r={rows.away} highlight />
      </div>
    </div>
  );
}
