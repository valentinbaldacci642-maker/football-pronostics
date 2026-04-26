import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Star, Share2, Clock, MapPin, Users } from 'lucide-react';
import { useFixtureDetail } from '../hooks/useFixtures';
import { usePredictions, useOdds, useScorers } from '../hooks/usePredictions';
import { useFavoritesStore } from '../store';
import PredictionWidget from '../components/match/PredictionWidget';
import { MatchWinnerOdds, OverUnderOdds, BTTSOdds, ExactScoreOdds, ValueBetsList } from '../components/match/OddsTable';
import { GoalsHistogram } from '../components/match/ProbabilityChart';
import ScorerPredictions from '../components/match/ScorerPredictions';
import { LoadingPage, ErrorState } from '../components/ui/Loading';
import { formatMatchDate, getMatchStatus, getScoreDisplay } from '../utils/format';
import clsx from 'clsx';

const TABS = ['Analyse', 'Cotes', 'Statistiques', 'Événements', 'Compositions', 'Buteurs'];

export default function MatchDetail() {
  const { id } = useParams();
  const [tab, setTab] = useState('Analyse');
  const { fixture, stats, events, lineups, loading, error } = useFixtureDetail(id);
  const { analysis, loading: analysisLoading } = usePredictions(id);
  const { oddsAnalysis } = useOdds(id);
  const { scorers, loading: scorersLoading, error: scorersError } = useScorers(id);
  const { toggle, isFavorite } = useFavoritesStore();

  if (loading) return <LoadingPage />;
  if (error || !fixture) return <ErrorState message={error || 'Match introuvable'} />;

  const { teams, league, fixture: fix } = fixture;
  const home = teams?.home;
  const away = teams?.away;
  const score = getScoreDisplay(fixture);
  const status = getMatchStatus(fixture);
  const isFav = isFavorite(id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-6"
    >
      {/* Back */}
      <div className="flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggle(parseInt(id))}
            className={clsx('btn-ghost !px-2.5 !py-2', isFav ? 'text-gold-400' : '')}
          >
            <Star className="w-4 h-4" fill={isFav ? 'currentColor' : 'none'} />
          </button>
          <button className="btn-ghost !px-2.5 !py-2">
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Match header */}
      <div className="glass-card p-6">
        {/* League */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {league?.logo && <img src={league.logo} alt="" className="w-5 h-5 object-contain" />}
          <span className="text-sm text-white/50 font-medium">{league?.name}</span>
          {league?.round && <span className="text-xs text-white/25">· {league.round}</span>}
        </div>

        {/* Teams + Score */}
        <div className="flex items-center gap-6">
          {/* Home team */}
          <div className="flex-1 flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-2xl bg-dark-700 flex items-center justify-center p-3">
              <img src={home?.logo} alt={home?.name} className="w-full h-full object-contain"
                onError={(e) => e.target.style.opacity = '0'} />
            </div>
            <div className="text-center">
              <p className="font-bold text-white text-lg leading-tight">{home?.name}</p>
              <p className="text-xs text-white/30">{fixture?.players?.[0]?.team?.name || 'Domicile'}</p>
            </div>
          </div>

          {/* Score / VS */}
          <div className="flex flex-col items-center gap-2">
            {score ? (
              <div className="flex items-center gap-3">
                <span className="text-5xl font-black text-white tabular-nums">{score.home}</span>
                <span className="text-2xl text-white/20">—</span>
                <span className="text-5xl font-black text-white tabular-nums">{score.away}</span>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-3xl font-black text-white/20">VS</p>
                <p className="text-lg font-bold text-brand-400 mt-1">{formatMatchDate(fix?.date)}</p>
              </div>
            )}
            {status.type === 'live' ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-live-dot" />
                <span className="text-sm text-red-400 font-bold">{status.label}</span>
              </div>
            ) : (
              <span className={clsx(
                'text-xs px-3 py-1 rounded-full font-medium',
                status.type === 'finished' ? 'bg-white/5 text-white/30' : 'bg-brand-500/15 text-brand-400'
              )}>
                {status.type === 'scheduled' ? formatMatchDate(fix?.date) : status.label}
              </span>
            )}
            <div className="flex items-center gap-3 text-xs text-white/25 mt-1">
              {fix?.venue?.name && (
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{fix.venue.name}</span>
              )}
            </div>
          </div>

          {/* Away team */}
          <div className="flex-1 flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-2xl bg-dark-700 flex items-center justify-center p-3">
              <img src={away?.logo} alt={away?.name} className="w-full h-full object-contain"
                onError={(e) => e.target.style.opacity = '0'} />
            </div>
            <div className="text-center">
              <p className="font-bold text-white text-lg leading-tight">{away?.name}</p>
              <p className="text-xs text-white/30">Extérieur</p>
            </div>
          </div>
        </div>

        {/* Consensus probs bar */}
        {analysis?.consensusProbs && (
          <div className="mt-6 space-y-2">
            <div className="flex justify-between text-xs text-white/40">
              <span>{home?.name}: {analysis.consensusProbs.home}%</span>
              <span>Nul: {analysis.consensusProbs.draw}%</span>
              <span>{away?.name}: {analysis.consensusProbs.away}%</span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden gap-px">
              <div className="bg-brand-500 rounded-full" style={{ width: `${analysis.consensusProbs.home}%` }} />
              <div className="bg-amber-500/70 rounded-full" style={{ width: `${analysis.consensusProbs.draw}%` }} />
              <div className="bg-blue-500 rounded-full" style={{ width: `${analysis.consensusProbs.away}%` }} />
            </div>
            <p className="text-xs text-center text-white/25">Consensus probabilités (cotes + IA)</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-dark-800 rounded-xl overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
              tab === t ? 'bg-dark-700 text-white' : 'text-white/40 hover:text-white/70'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatedTab>
        {tab === 'Analyse' && (
          <div className="space-y-4">
            {analysisLoading ? (
              <div className="text-center py-8 text-white/30">Calcul des probabilités...</div>
            ) : (
              <PredictionWidget
                analysis={analysis}
                homeTeam={home?.name}
                awayTeam={away?.name}
              />
            )}
            {analysis?.predictions?.mostLikelyScores && (
              <div className="glass-card p-4">
                <div className="flex items-start justify-between mb-1">
                  <h4 className="text-xs text-white/40 uppercase tracking-wider font-semibold">Scores les plus probables</h4>
                  <span className="text-xs text-blue-400/60 font-medium">Modèle Poisson (xG)</span>
                </div>
                <p className="text-xs text-white/20 mb-4">
                  Calculé à partir des xG attendus — différent des cotes bookmakers (onglet Cotes)
                </p>
                <GoalsHistogram
                  data={analysis.predictions.mostLikelyScores.map((s) => ({
                    score: `${s.home}-${s.away}`,
                    prob: s.prob,
                  }))}
                />
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {analysis.predictions.mostLikelyScores.slice(0, 6).map((s, i) => (
                    <div key={i} className={clsx(
                      'flex items-center justify-between px-3 py-2 rounded-lg border text-xs',
                      i === 0 ? 'bg-blue-500/15 border-blue-500/30' : 'bg-dark-700 border-white/5'
                    )}>
                      <span className={clsx('font-bold font-mono text-sm', i === 0 ? 'text-blue-400' : 'text-white')}>
                        {s.home}-{s.away}
                      </span>
                      <span className={clsx(i === 0 ? 'text-blue-300' : 'text-white/30')}>
                        {s.prob?.toFixed(1)}% <span className="text-white/20">(xG)</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'Cotes' && (
          <div className="space-y-5">
            {oddsAnalysis?.valueBets?.length > 0 && (
              <ValueBetsList valueBets={oddsAnalysis.valueBets} />
            )}
            <div className="glass-card p-4 space-y-6">
              <MatchWinnerOdds data={oddsAnalysis?.matchWinner} />
              <div className="border-t border-white/5" />
              <OverUnderOdds data={oddsAnalysis?.goalsOverUnder} />
              <div className="border-t border-white/5" />
              <BTTSOdds data={oddsAnalysis?.btts} />
              {oddsAnalysis?.exactScore?.length > 0 && (
                <>
                  <div className="border-t border-white/5" />
                  <ExactScoreOdds data={oddsAnalysis.exactScore} />
                </>
              )}
            </div>
          </div>
        )}

        {tab === 'Statistiques' && (
          <StatsTab stats={stats} home={home} away={away} />
        )}

        {tab === 'Événements' && (
          <EventsTab events={events} home={home} away={away} />
        )}

        {tab === 'Compositions' && (
          <LineupsTab lineups={lineups} />
        )}

        {tab === 'Buteurs' && (
          <ScorerPredictions data={scorers} loading={scorersLoading} error={scorersError} />
        )}
      </AnimatedTab>
    </motion.div>
  );
}

function AnimatedTab({ children }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      {children}
    </motion.div>
  );
}

function StatsTab({ stats, home, away }) {
  if (!stats?.length) return <div className="text-center py-8 text-white/30">Statistiques non disponibles</div>;

  const homeStats = stats.find((s) => s.team?.id === home?.id)?.statistics || [];
  const awayStats = stats.find((s) => s.team?.id === away?.id)?.statistics || [];

  const pairs = homeStats.map((hs) => {
    const as_ = awayStats.find((s) => s.type === hs.type);
    return { type: hs.type, home: hs.value, away: as_?.value };
  }).filter((p) => p.home !== null || p.away !== null);

  const parseValue = (v) => {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'string' && v.includes('%')) return parseFloat(v);
    return parseFloat(v) || 0;
  };

  return (
    <div className="glass-card p-4 space-y-4">
      <div className="flex items-center justify-between text-sm font-bold text-white/60 mb-4">
        <span className="flex items-center gap-2">
          <img src={home?.logo} alt="" className="w-5 h-5 object-contain" />
          {home?.name}
        </span>
        <span>Statistique</span>
        <span className="flex items-center gap-2">
          {away?.name}
          <img src={away?.logo} alt="" className="w-5 h-5 object-contain" />
        </span>
      </div>
      {pairs.map(({ type, home: hv, away: av }) => {
        const h = parseValue(hv), a = parseValue(av);
        const total = h + a || 1;
        return (
          <div key={type} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white">{hv ?? '—'}</span>
              <span className="text-white/40">{type}</span>
              <span className="font-bold text-white">{av ?? '—'}</span>
            </div>
            <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
              <div className="bg-brand-500/80 rounded-full" style={{ width: `${(h / total) * 100}%` }} />
              <div className="bg-blue-500/80 rounded-full flex-1" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EventsTab({ events, home, away }) {
  if (!events?.length) return <div className="text-center py-8 text-white/30">Aucun événement</div>;

  const getEventIcon = (type) => {
    if (type === 'Goal') return '⚽';
    if (type === 'Card') return '🟨';
    if (type === 'subst') return '🔄';
    if (type === 'Var') return '📺';
    return '•';
  };

  return (
    <div className="glass-card p-4 space-y-2">
      {events.map((ev, i) => {
        const isHome = ev.team?.id === home?.id;
        return (
          <div key={i} className={clsx('flex items-center gap-3 py-2', isHome ? 'flex-row' : 'flex-row-reverse')}>
            <span className="text-xs text-white/30 font-mono w-8 text-right">{ev.time?.elapsed}'</span>
            <span className="text-lg">{getEventIcon(ev.type)}</span>
            <div className={clsx('flex-1', isHome ? 'text-left' : 'text-right')}>
              <p className="text-sm font-medium text-white">{ev.player?.name}</p>
              {ev.assist?.name && <p className="text-xs text-white/30">Assist: {ev.assist.name}</p>}
              {ev.detail && <p className="text-xs text-white/20">{ev.detail}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LineupsTab({ lineups }) {
  if (!lineups?.length) return <div className="text-center py-8 text-white/30">Compositions non disponibles</div>;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {lineups.map((lu) => (
        <div key={lu.team?.id} className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <img src={lu.team?.logo} alt="" className="w-6 h-6 object-contain" />
            <span className="font-semibold text-white">{lu.team?.name}</span>
            <span className="text-xs text-white/30 ml-auto">{lu.formation}</span>
          </div>
          <div className="space-y-1.5">
            {lu.startXI?.map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-5 h-5 rounded bg-dark-600 flex items-center justify-center text-white/50 font-mono flex-shrink-0">
                  {p.player?.number}
                </span>
                <span className="text-white/80">{p.player?.name}</span>
                <span className="text-white/30 ml-auto">{p.player?.pos}</span>
              </div>
            ))}
          </div>
          {lu.substitutes?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <p className="text-xs text-white/25 mb-2">Remplaçants</p>
              {lu.substitutes.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-xs py-0.5">
                  <span className="w-5 h-5 rounded bg-dark-600/50 flex items-center justify-center text-white/30 font-mono flex-shrink-0">
                    {p.player?.number}
                  </span>
                  <span className="text-white/40">{p.player?.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
