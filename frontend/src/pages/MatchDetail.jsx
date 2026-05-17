import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Star, Share2, Clock, MapPin, Users } from 'lucide-react';
import { useFixtureDetail } from '../hooks/useFixtures';
import { usePredictions, useOdds, useScorers } from '../hooks/usePredictions';
import { useFavoritesStore } from '../store';
import PredictionWidget from '../components/match/PredictionWidget';
import { MatchWinnerOdds, OverUnderOdds, BTTSOdds, ExactScoreOdds, HandicapOdds, PlayerPropsOdds } from '../components/match/OddsTable';
import BookmakersComparison from '../components/match/BookmakersComparison';
import { GoalsHistogram } from '../components/match/ProbabilityChart';
import ScorerPredictions from '../components/match/ScorerPredictions';
import LiveOddsBanner from '../components/match/LiveOddsBanner';
import ValueBetsKelly from '../components/match/ValueBetsKelly';
import { LoadingPage, ErrorState } from '../components/ui/Loading';
import { formatMatchDate, getMatchStatus, getScoreDisplay } from '../utils/format';
import clsx from 'clsx';

const TABS = ['Analyse', 'Cotes', 'Statistiques', 'Événements', 'Compositions', 'Buteurs'];

export default function MatchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('Analyse');

  const goBack = () => {
    // Use browser history when there is one (came from /matchs, /history, etc.)
    // Fallback to home when the user opened the match page directly.
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };
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
      className="max-w-4xl xl:max-w-6xl mx-auto space-y-6"
    >
      {/* Back */}
      <div className="flex items-center justify-between">
        <button onClick={goBack} className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>
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
          <Link to={`/team/${home?.id}`} className="flex-1 flex flex-col items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-20 h-20 rounded-2xl bg-dark-700 flex items-center justify-center p-3">
              <img src={home?.logo} alt={home?.name} className="w-full h-full object-contain"
                onError={(e) => e.target.style.opacity = '0'} />
            </div>
            <div className="text-center">
              <p className="font-bold text-white text-lg leading-tight">{home?.name}</p>
              <p className="text-xs text-white/30">{fixture?.players?.[0]?.team?.name || 'Domicile'}</p>
            </div>
          </Link>

          {/* Score / VS */}
          <div className="flex flex-col items-center gap-2">
            {score ? (
              <div className="flex items-center gap-3">
                <span className="font-display text-6xl text-white tabular-nums tracking-wider">{score.home}</span>
                <span className="font-display text-2xl text-white/15 tracking-widest">—</span>
                <span className="font-display text-6xl text-white tabular-nums tracking-wider">{score.away}</span>
              </div>
            ) : (
              <div className="text-center">
                <p className="font-display text-4xl text-white/15 tracking-widest">VS</p>
                <p className="text-sm font-heading font-semibold text-brand-400 mt-1">{formatMatchDate(fix?.date)}</p>
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
          <Link to={`/team/${away?.id}`} className="flex-1 flex flex-col items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-20 h-20 rounded-2xl bg-dark-700 flex items-center justify-center p-3">
              <img src={away?.logo} alt={away?.name} className="w-full h-full object-contain"
                onError={(e) => e.target.style.opacity = '0'} />
            </div>
            <div className="text-center">
              <p className="font-bold text-white text-lg leading-tight">{away?.name}</p>
              <p className="text-xs text-white/30">Extérieur</p>
            </div>
          </Link>
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
            <LiveOddsBanner fixtureId={id} fixtureStatus={fix?.status?.short} />
            <ValueBetsKelly valueBets={oddsAnalysis?.valueBets} />
            {analysisLoading ? (
              <div className="text-center py-8 text-white/30">Calcul des probabilités...</div>
            ) : (
              <PredictionWidget
                analysis={analysis}
                homeTeam={home?.name}
                awayTeam={away?.name}
              />
            )}
            {analysis?.predictions?.expectedGoals && (
              <PoissonMatrix
                xG={analysis.predictions.expectedGoals}
                homeTeam={home?.name}
                awayTeam={away?.name}
              />
            )}
          </div>
        )}

        {tab === 'Cotes' && (
          <div className="space-y-5">
            <div className="glass-card p-4 space-y-6">
              <MatchWinnerOdds data={oddsAnalysis?.matchWinner} />
              <div className="border-t border-white/5" />
              <OverUnderOdds data={oddsAnalysis?.goalsOverUnder} />
              <div className="border-t border-white/5" />
              <BTTSOdds data={oddsAnalysis?.btts} />
              {oddsAnalysis?.handicap?.length > 0 && (
                <>
                  <div className="border-t border-white/5" />
                  <HandicapOdds data={oddsAnalysis.handicap} />
                </>
              )}
              {oddsAnalysis?.anytimeGoalscorer?.length > 0 && (
                <>
                  <div className="border-t border-white/5" />
                  <PlayerPropsOdds data={oddsAnalysis.anytimeGoalscorer} title="Buteurs (n'importe quand)" />
                </>
              )}
              {oddsAnalysis?.firstGoalscorer?.length > 0 && (
                <>
                  <div className="border-t border-white/5" />
                  <PlayerPropsOdds data={oddsAnalysis.firstGoalscorer} title="Premier buteur" />
                </>
              )}
              {oddsAnalysis?.exactScore?.length > 0 && (
                <>
                  <div className="border-t border-white/5" />
                  <ExactScoreOdds data={oddsAnalysis.exactScore} />
                </>
              )}
            </div>
            <BookmakersComparison fixtureId={id} homeTeam={home?.name} awayTeam={away?.name} />
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

// Traduction des libellés bruts d'API-Football. Toute clé non listée
// retombe sur le libellé original (mieux que vide).
const STAT_LABEL_FR = {
  'Shots on Goal': 'Tirs cadrés',
  'Shots off Goal': 'Tirs non cadrés',
  'Total Shots': 'Tirs (total)',
  'Blocked Shots': 'Tirs contrés',
  'Shots insidebox': 'Tirs dans la surface',
  'Shots outsidebox': 'Tirs hors surface',
  'Fouls': 'Fautes',
  'Corner Kicks': 'Corners',
  'Offsides': 'Hors-jeu',
  'Ball Possession': 'Possession',
  'Yellow Cards': 'Cartons jaunes',
  'Red Cards': 'Cartons rouges',
  'Goalkeeper Saves': 'Arrêts gardien',
  'Total passes': 'Passes (total)',
  'Passes accurate': 'Passes réussies',
  'Passes %': '% passes réussies',
  'expected_goals': 'Buts attendus (xG)',
  'goals_prevented': 'Buts évités',
};

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
        const labelFr = STAT_LABEL_FR[type] || type;
        return (
          <div key={type} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white">{hv ?? '—'}</span>
              <span className="text-white/40">{labelFr}</span>
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

  const getEvent = (ev) => {
    const type = ev.type;
    const detail = ev.detail || '';
    if (type === 'Goal') {
      if (detail.includes('Own')) return { icon: '⚽', detailFr: 'csc', isGoal: true };
      if (detail.includes('Penalty')) return { icon: '⚽', detailFr: 'pen.', isGoal: true };
      if (detail.includes('Missed Penalty')) return { icon: '❌', detailFr: 'pen. manqué', isGoal: false };
      return { icon: '⚽', detailFr: null, isGoal: true };
    }
    if (type === 'Card') {
      if (detail.includes('Red')) return { icon: '🟥', detailFr: detail.replace('Red Card', '').trim() || null };
      if (detail.includes('Yellow')) {
        // Traduire les fautes courantes
        const faultMap = {
          'Foul': 'Faute',
          'Tackle': 'Tacle',
          'Hand ball': 'Main',
          'Argument': 'Contestation',
          'Tripping': 'Croche-pied',
          'Pushing': 'Poussée',
          'Holding': 'Tenu',
          'Time wasting': 'Anti-jeu',
          'Diving': 'Simulation',
          'Persistent fouling': 'Fautes répétées',
          'Dissent': 'Contestation',
          'Reckless tackle': 'Tacle dangereux',
        };
        const cleaned = detail.replace('Yellow Card', '').trim();
        const fr = faultMap[cleaned] || cleaned || null;
        return { icon: '🟨', detailFr: fr };
      }
      return { icon: '🟨', detailFr: detail || null };
    }
    if (type === 'subst') return { icon: '🔄', detailFr: null, isSub: true };
    if (type === 'Var') return { icon: '📺', detailFr: detail || 'VAR' };
    return { icon: '•', detailFr: detail || type };
  };

  const formatMinute = (time) => {
    const m = time?.elapsed;
    const extra = time?.extra;
    if (m == null) return '';
    return extra ? `${m}+${extra}'` : `${m}'`;
  };

  // Détermine la mi-temps de l'event à partir de la minute :
  // - elapsed <= 45 → 1ère MT (incl. additionnel 45+x)
  // - 46-90       → 2e MT
  // - 91-105      → prolongation 1
  // - 106-120     → prolongation 2
  const periodKey = (ev) => {
    const m = ev?.time?.elapsed ?? 0;
    if (m <= 45) return 'ht1';
    if (m <= 90) return 'ht2';
    if (m <= 105) return 'et1';
    return 'et2';
  };
  const periodLabel = {
    ht1: '1ʳᵉ mi-temps',
    ht2: '2ᵉ mi-temps',
    et1: 'Prolongations',
    et2: 'Prolongations',
  };

  // Score cumulé par event + score final par période.
  // Note CSC : API-Football attribue déjà le team field à l'équipe qui
  // BÉNÉFICIE du but (et non à celle du joueur). Confirmé sur Strasbourg
  // vs Monaco : un OG par un joueur Monaco bénéficie à Strasbourg, mais
  // l'event API arrive avec team=Monaco… qui correspond bien au compteur
  // visible côté UI réelle (5-4 et pas 6-3). On compte donc directement
  // par ev.team sans logique d'inversion.
  const scoreByPeriod = { ht1: [0, 0], ht2: [0, 0], et1: [0, 0], et2: [0, 0] };
  const scoreAfter = [];
  let hg = 0, ag = 0;
  events.forEach((ev, i) => {
    const meta = getEvent(ev);
    if (meta.isGoal) {
      if (ev.team?.id === home?.id) hg += 1;
      else ag += 1;
    }
    scoreAfter[i] = meta.isGoal ? `${hg} - ${ag}` : null;
    scoreByPeriod[periodKey(ev)] = [hg, ag];
  });

  // Groupe les events par période en gardant l'ordre chronologique
  const grouped = events.reduce((acc, ev, i) => {
    const k = periodKey(ev);
    if (!acc[k]) acc[k] = [];
    acc[k].push({ ev, i });
    return acc;
  }, {});
  const orderedPeriods = ['ht1', 'ht2', 'et1', 'et2'].filter((k) => grouped[k]?.length);

  return (
    <div className="glass-card overflow-hidden">
      {orderedPeriods.map((pkey, pi) => {
        const [phg, pag] = scoreByPeriod[pkey];
        return (
          <div key={pkey}>
            {/* En-tête de mi-temps : bandeau sombre avec label + score */}
            <div className={clsx(
              'flex items-center justify-between px-4 py-2 bg-dark-800/80 border-b border-white/5',
              pi > 0 && 'border-t border-white/5',
            )}>
              <span className="text-[11px] text-white/55 uppercase tracking-wider font-heading font-bold">
                {pi + 1}. {periodLabel[pkey]}
              </span>
              <span className="text-sm text-white font-display font-bold tabular-nums">
                {phg} - {pag}
              </span>
            </div>

            {/* Events de cette période */}
            <div className="py-2">
              {grouped[pkey].map(({ ev, i }) => {
                const isHome = ev.team?.id === home?.id;
                const meta = getEvent(ev);
                const score = scoreAfter[i];

                // Bloc texte d'un event normal (but / carton / var…)
                const contentRow = (
                  <div className={clsx(
                    'flex items-center gap-2 text-sm min-w-0',
                    isHome ? 'flex-row' : 'flex-row-reverse text-right',
                  )}>
                    <span className="text-base flex-shrink-0">{meta.icon}</span>
                    {meta.isGoal && (
                      <span className="text-white font-display font-bold tabular-nums whitespace-nowrap">
                        {score}
                      </span>
                    )}
                    <div className="min-w-0 flex-1 truncate">
                      <span className="text-white font-heading font-bold">{ev.player?.name}</span>
                      {ev.assist?.name && meta.isGoal && (
                        <span className="text-white/45 font-heading"> ({ev.assist.name})</span>
                      )}
                      {meta.detailFr && !meta.isGoal && (
                        <span className="text-white/45 font-heading"> ({meta.detailFr})</span>
                      )}
                    </div>
                  </div>
                );

                // Bloc spécial substitution : Entrant ↔ Sortant côte à côte
                const subRow = (
                  <div className={clsx(
                    'flex items-center gap-2 text-sm min-w-0',
                    isHome ? 'flex-row' : 'flex-row-reverse text-right',
                  )}>
                    <span className="text-base flex-shrink-0">{meta.icon}</span>
                    <div className="min-w-0 flex-1 truncate">
                      <span className="text-brand-300 font-heading font-bold">{ev.assist?.name || '—'}</span>
                      <span className="text-white/45 font-heading"> {ev.player?.name || '—'}</span>
                    </div>
                  </div>
                );

                const eventContent = meta.isSub ? subRow : contentRow;
                const minuteLabel = (
                  <span className="text-xs text-white/45 font-mono tabular-nums w-12 flex-shrink-0">
                    {formatMinute(ev.time)}
                  </span>
                );

                return (
                  <div key={i} className="grid grid-cols-2 gap-2 px-3 py-1.5 hover:bg-white/[0.02]">
                    {/* Côté domicile */}
                    <div className="flex items-center gap-2 min-w-0">
                      {isHome && minuteLabel}
                      {isHome && eventContent}
                    </div>
                    {/* Côté extérieur (les 2 colonnes mirroir, minute à droite) */}
                    <div className="flex items-center gap-2 min-w-0 justify-end">
                      {!isHome && eventContent}
                      {!isHome && minuteLabel}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function poissonProb(lambda, k) {
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 1; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP) * 100;
}

function buildMatrix(homeXG, awayXG, max = 5) {
  const cells = [];
  for (let h = 0; h <= max; h++) {
    for (let a = 0; a <= max; a++) {
      cells.push({ h, a, prob: parseFloat((poissonProb(homeXG, h) * poissonProb(awayXG, a) / 100).toFixed(2)) });
    }
  }
  return cells;
}

function greenColor(prob, maxProb) {
  const t = Math.min(1, prob / maxProb);
  // light green (t=0) → dark green (t=1)
  const r = Math.round(220 - t * 185);
  const g = Math.round(252 - t * 130);
  const b = Math.round(231 - t * 210);
  return `rgb(${r},${g},${b})`;
}

function PoissonMatrix({ xG, homeTeam, awayTeam }) {
  const MAX = 5;
  const cells = buildMatrix(xG.home, xG.away, MAX);
  const maxProb = Math.max(...cells.map((c) => c.prob));
  const cols = Array.from({ length: MAX + 1 }, (_, i) => i);
  const rows = Array.from({ length: MAX + 1 }, (_, i) => i);

  return (
    <div className="glass-card p-4">
      <div className="flex items-start justify-between mb-1">
        <h4 className="text-xs text-white/40 uppercase tracking-wider font-semibold">Matrice des scores — Modèle Poisson</h4>
        <span className="text-xs text-blue-400/60 font-medium">xG</span>
      </div>
      <p className="text-xs text-white/20 mb-1">
        Probabilité de chaque score exact · xG dom. {xG.home} / ext. {xG.away}
      </p>
      {xG.source === 'season' && xG.sampleSize?.home != null && xG.sampleSize?.away != null && (
        <div className="text-xs text-brand-400/70 mb-2 space-y-0.5">
          <div>{homeTeam || 'Domicile'} · {xG.sampleSize.home} matchs joués cette saison</div>
          <div>{awayTeam || 'Extérieur'} · {xG.sampleSize.away} matchs joués cette saison</div>
        </div>
      )}
      {(xG.lineupAdjustments?.home?.absentTopScorer || xG.lineupAdjustments?.away?.absentTopScorer) && (
        <div className="text-xs text-orange-400/85 mb-3 space-y-0.5">
          {xG.lineupAdjustments?.home?.absentTopScorer && (
            <div>
              ⚠️ {homeTeam || 'Domicile'} · top scoreur absent : {xG.lineupAdjustments.home.absentTopScorer.name}
              {' '}({xG.lineupAdjustments.home.absentTopScorer.goals} buts) — xG ajusté −{Math.round(xG.lineupAdjustments.home.xgPenalty * 100)}%
            </div>
          )}
          {xG.lineupAdjustments?.away?.absentTopScorer && (
            <div>
              ⚠️ {awayTeam || 'Extérieur'} · top scoreur absent : {xG.lineupAdjustments.away.absentTopScorer.name}
              {' '}({xG.lineupAdjustments.away.absentTopScorer.goals} buts) — xG ajusté −{Math.round(xG.lineupAdjustments.away.xgPenalty * 100)}%
            </div>
          )}
        </div>
      )}
      {(!xG.source || xG.source !== 'season') && <div className="mb-4" />}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="p-1.5 text-white/30 font-medium text-left w-16">
                <span className="text-white/20">Dom. \ Ext.</span>
              </th>
              {cols.map((a) => (
                <th key={a} className="p-1.5 text-center text-white/50 font-bold w-12">{a}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((h) => (
              <tr key={h}>
                <td className="p-1.5 text-white/50 font-bold text-center">{h}</td>
                {cols.map((a) => {
                  const cell = cells.find((c) => c.h === h && c.a === a);
                  const bg = greenColor(cell.prob, maxProb);
                  const isTop = cell.prob === maxProb;
                  return (
                    <td
                      key={a}
                      className="p-0 text-center"
                      title={`${h}-${a}: ${cell.prob}%`}
                    >
                      <div
                        className={clsx('mx-0.5 my-0.5 rounded-lg flex flex-col items-center justify-center h-11 w-full transition-all', isTop && 'ring-1 ring-white/40')}
                        style={{ backgroundColor: bg }}
                      >
                        <span className="font-black text-xs text-gray-800">{cell.prob.toFixed(1)}</span>
                        <span className="text-gray-600 text-[10px] leading-none">%</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3 mt-3 justify-end">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: greenColor(0, 1) }} />
          <span className="text-xs text-white/30">Faible</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: greenColor(0.5, 1) }} />
          <span className="text-xs text-white/30">Moyen</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: greenColor(1, 1) }} />
          <span className="text-xs text-white/30">Élevé</span>
        </div>
      </div>
    </div>
  );
}

// Affiche le startXI sur un mini-terrain vertical. API-Football fournit
// `player.grid` au format "row:col" où row 1 = ligne devant le gardien
// (donc défense), row max = ligne d'attaque la plus avancée. On positionne
// chaque ligne du bas (row 1 = près du gardien) vers le haut (row max =
// avant-centres). Si grid est absent, on retombe sur une liste simple.
function SoccerField({ players }) {
  const valid = (players || []).filter((p) => p?.player?.grid);
  if (valid.length < 7) return null; // données incomplètes → fallback liste

  const byRow = {};
  valid.forEach((p) => {
    const [r, c] = p.player.grid.split(':').map(Number);
    if (!Number.isFinite(r)) return;
    if (!byRow[r]) byRow[r] = [];
    byRow[r].push({ ...p, _col: c || 1 });
  });
  const rows = Object.keys(byRow).map(Number).sort((a, b) => a - b);
  if (rows.length === 0) return null;
  const maxRow = Math.max(...rows);

  return (
    <div className="relative aspect-[2/2.6] rounded-lg overflow-hidden bg-gradient-to-b from-emerald-700/50 via-emerald-600/40 to-emerald-700/50 border border-emerald-500/30 my-3">
      {/* Lignes du terrain */}
      <div className="absolute inset-2 border-2 border-white/25 rounded-sm" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[28%] aspect-square rounded-full border-2 border-white/25" />
      <div className="absolute left-2 right-2 top-1/2 h-px bg-white/25" />
      {/* Surfaces de réparation */}
      <div className="absolute left-[20%] right-[20%] top-2 h-[14%] border-2 border-t-0 border-white/25" />
      <div className="absolute left-[20%] right-[20%] bottom-2 h-[14%] border-2 border-b-0 border-white/25" />

      {/* Joueurs */}
      {rows.map((r) => {
        const rowPlayers = byRow[r].sort((a, b) => a._col - b._col);
        // row 1 = défense → bas, row max = attaque → haut
        const yPercent = 90 - ((r - 1) / Math.max(1, maxRow - 1)) * 80;
        return rowPlayers.map((p, idx) => {
          const xPercent = ((idx + 1) / (rowPlayers.length + 1)) * 100;
          // Nom court : dernier mot (généralement le nom de famille)
          const lastName = (p.player?.name || '').trim().split(' ').slice(-1)[0];
          return (
            <div
              key={`${r}-${idx}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
              style={{ left: `${xPercent}%`, top: `${yPercent}%` }}
            >
              <div className="w-11 h-11 rounded-full bg-brand-500 border-2 border-white shadow-lg flex items-center justify-center text-sm font-display font-bold text-white">
                {p.player?.number ?? '—'}
              </div>
              <div className="mt-1 bg-black/75 backdrop-blur-sm px-1.5 py-0.5 rounded text-xs text-white font-heading font-bold whitespace-nowrap max-w-[100px] truncate leading-tight">
                {lastName}
              </div>
            </div>
          );
        });
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
          <div className="flex items-center gap-2 mb-1">
            <img src={lu.team?.logo} alt="" className="w-6 h-6 object-contain" />
            <span className="font-semibold text-white">{lu.team?.name}</span>
            <span className="text-xs text-white/30 ml-auto font-mono">{lu.formation}</span>
          </div>

          {/* Mini terrain — affiché si la grid des joueurs est dispo */}
          <SoccerField players={lu.startXI} />

          {/* Liste textuelle du XI (fallback si grid absente, ou complément) */}
          <div className="space-y-2 mt-3">
            <p className="text-xs text-white/45 uppercase tracking-wider font-heading font-bold">Onze titulaire</p>
            {lu.startXI?.map((p, i) => (
              <div key={i} className="flex items-center gap-2.5 text-sm">
                <span className="w-7 h-7 rounded-md bg-dark-600 flex items-center justify-center text-white/70 font-mono font-bold text-xs flex-shrink-0">
                  {p.player?.number}
                </span>
                <span className="text-white font-heading font-semibold truncate flex-1">{p.player?.name}</span>
                <span className="text-xs text-white/40 font-mono">{p.player?.pos}</span>
              </div>
            ))}
          </div>

          {lu.substitutes?.length > 0 && (
            <div className="mt-4 pt-3 border-t border-white/10">
              <p className="text-xs text-white/45 uppercase tracking-wider font-heading font-bold mb-2">Remplaçants</p>
              {lu.substitutes.map((p, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm py-1">
                  <span className="w-7 h-7 rounded-md bg-dark-600/60 flex items-center justify-center text-white/50 font-mono font-bold text-xs flex-shrink-0">
                    {p.player?.number}
                  </span>
                  <span className="text-white/70 font-heading truncate flex-1">{p.player?.name}</span>
                  <span className="text-xs text-white/30 font-mono">{p.player?.pos}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
