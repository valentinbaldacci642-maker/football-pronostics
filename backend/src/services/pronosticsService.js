const api = require('./apiFootball');
const analysisService = require('./analysisService');
const cache = require('../utils/cache');
const logger = require('../utils/logger');

// Leagues ranked by prestige/data quality — TOP TIER (places ~1-21).
// Ces ligues passent en deep analysis (top 10) ou en début de lite scan.
const PRIORITY_LEAGUES = [
  2, 3, 848,                    // UEFA Champions / Europa / Conference
  39, 140, 135, 61, 78,         // Top 5 first divisions
  40, 62, 79, 136, 141,         // Top 5 second divisions
  88, 94,                       // Eredivisie, Primeira Liga
  253, 307,                     // MLS, Saudi Pro
  45, 48,                       // FA Cup, EFL Cup
  71, 128,                      // Brasileirão, Liga Argentina
];

// Ligues secondaires couvertes par Unibet.fr — passent en lite scan APRÈS
// les PRIORITY_LEAGUES, mais AVANT le reste du monde. Source : screenshots
// Unibet.fr fournis par l'utilisateur. Coverage typique : 1ère division des
// pays moyens (Pologne, Suisse, Autriche, Suède, Belgique, etc) + quelques
// coupes nationales + ligues Amérique du Sud + Asie.
const UNIBET_SECONDARY_LEAGUES = [
  144,                          // Belgique D1
  207,                          // Suisse Super League
  218,                          // Autriche Bundesliga
  179, 181,                     // Écosse: Premiership + Cup
  119,                          // Danemark Superligaen
  103,                          // Norvège Eliteserien
  113,                          // Suède Allsvenskan
  244,                          // Finlande Veikkausliiga
  164,                          // Islande Úrvalsdeild
  106,                          // Pologne Ekstraklasa
  345,                          // Tchéquie Fortuna liga
  283,                          // Roumanie Liga I
  271, 273,                     // Hongrie NB I + Magyar Kupa
  332,                          // Slovaquie Super liga
  373,                          // Slovénie PrvaLiga
  210,                          // Croatie HNL
  286,                          // Serbie Super Liga
  333,                          // Ukraine Premier League
  172,                          // Bulgarie First League
  315,                          // Bosnie Premijer Liga
  197,                          // Grèce Super League
  203,                          // Turquie Süper Lig
  165,                          // Chypre 1. Division
  329,                          // Géorgie Erovnuli Liga
  327,                          // Estonie Meistriliiga
  365,                          // Lettonie Virslīga
  362,                          // Lituanie A Lyga
  261,                          // Luxembourg BGL Ligue
  357,                          // Irlande Premier Division
  408,                          // Irlande du Nord Premiership
  13, 11,                       // CONMEBOL Libertadores + Sudamericana
  73, 130,                      // Copa do Brasil + Copa Argentina
  265, 239, 242, 284,           // Chili / Colombie / Équateur / Paraguay
  262,                          // Mexique Liga MX
  383,                          // Israël Ligat ha'Al
  186, 200,                     // Algérie L1 / Maroc Botola
  98, 292,                      // Japon J1 / Corée K League 1
  169, 188,                     // Chine Super League / Australie A-League
  419,                          // Azerbaïdjan Premier League
  525,                          // UEFA Women's Champions League
  5, 1, 32, 29, 31, 30, 34, 33, // Nations League + WC + qualifs
  81, 137, 95, 96, 66,          // Coupes : DFB-Pokal, Coppa Italia, Liga Portugal 2, Taça Portugal, Coupe de France
];

class PronosticsService {
  async getBestPronostics(forceRefresh = false, date = null) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const cacheKey = cache.buildKey('pronostics', targetDate);
    const lastScanKey = cache.buildKey('pronostics-lastscan', targetDate);

    if (!forceRefresh) {
      const cached = cache.get(cacheKey);
      if (cached && cached.length > 0) return cached;
    } else {
      // Force-refresh cooldown: minimum 1 min between scans. Just enough
      // to prevent double-clicks / runaway loops on Ultra's generous quota.
      const lastScan = cache.get(lastScanKey);
      if (lastScan && Date.now() - lastScan < 60 * 1000) {
        const cached = cache.get(cacheKey);
        if (cached && cached.length > 0) return cached;
      }
    }

    let fixtures = [];
    try {
      const res = await api.getFixturesByDate(targetDate, null, null);
      fixtures = res.response || [];
    } catch (e) {
      logger.error('PronosticsService: failed to get fixtures', e.message);
      return [];
    }

    // Include pre-match (NS/TBD) AND live matches. Excluding only finished
    // / cancelled / abandoned states means VBs on a match in progress still
    // show up — useful for live betting and matches the per-fixture analysis
    // already shows. Bookmaker odds for live matches are typically the
    // pre-match snapshot from API-Football's /odds endpoint, which is fine
    // since our analysis was computed pre-kickoff.
    const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO']);
    // Tri 3-niveaux : PRIORITY_LEAGUES (UEFA + top 5) → UNIBET_SECONDARY
    // (les ~50 autres ligues couvertes par Unibet.fr) → tout le reste. Comme
    // ça, sur une journée chargée (800+ fixtures), les 250 premiers scannés
    // appartiennent tous à des ligues que l'utilisateur peut effectivement
    // parier sur Unibet, au lieu de gaspiller le budget sur des ligues
    // mineures jamais proposées par le bookmaker.
    const tier = (id) => {
      const top = PRIORITY_LEAGUES.indexOf(id);
      if (top !== -1) return top;
      const sec = UNIBET_SECONDARY_LEAGUES.indexOf(id);
      if (sec !== -1) return 100 + sec;
      return 9999;
    };
    const upcoming = fixtures
      .filter((f) => !FINISHED_STATUSES.has(f.fixture?.status?.short))
      .sort((a, b) => tier(a.league?.id) - tier(b.league?.id));

    if (upcoming.length === 0) return [];

    // Step 1 — full analysis on the top-10 priority fixtures.
    // 6 API calls each (odds, predictions, home stats, away stats, lineups,
    // top scorers). Outbound throttler in apiFootball.js handles pacing.
    const top10 = upcoming.slice(0, 10);
    const top10Analyses = await this._analyzeBatch(top10, { full: true });

    // Step 2 — LITE SCAN the next 240 fixtures (odds-only, 1 call each).
    // Avec le tri 3-niveaux, ces 240 viennent en priorité des ligues Unibet,
    // ce qui maximise les chances de trouver des VBs effectivement jouables.
    // Ultra quota (75k/jour) absorbe : 250 calls × 8 jours = 2k req, large.
    const remaining = upcoming.slice(10, 250);
    const liteScanCandidates = await this._liteScanForValueBets(remaining);

    // Step 3 — full analysis on the lite-scan candidates that DID find a VB.
    // Cap at 50 to bound cost on exceptionally rich days.
    const cappedCandidates = liteScanCandidates.slice(0, 50);
    const candidateAnalyses = await this._analyzeBatch(cappedCandidates, { full: true });

    // Combine
    const combined = [
      ...this._buildPronostics(top10, top10Analyses),
      ...this._buildPronostics(cappedCandidates, candidateAnalyses),
    ];

    // Dedupe by fixture id (top10 vs candidates shouldn't overlap, but safety)
    const seen = new Set();
    const unique = combined.filter((p) => {
      const id = p.fixture?.fixture?.id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    }).sort((a, b) => b.confidence - a.confidence);

    // Two-tier inclusion:
    //   1. Confident matches (≥45) → always shown
    //   2. Matches with ANY value bet → always shown (even if confidence is low)
    //      so a Shin VB from clean bookmaker odds can never be silently dropped
    //      because the prediction-derived confidence happened to fall short.
    //   3. Fallback: top 3 by confidence so the homepage never shows nothing.
    const hasVB = (p) => ((p.analysis?.odds?.valueBets) || []).length > 0;
    const reliable = unique.filter((p) => p.confidence >= 45);
    const valueBetMatches = unique.filter((p) => p.confidence < 45 && hasVB(p));
    const pronostics = (reliable.length > 0 || valueBetMatches.length > 0)
      ? [...reliable, ...valueBetMatches]
      : unique.slice(0, 3);

    cache.set(cacheKey, pronostics, 2 * 3600);          // 2h cache (Ultra quota allows fresher data)
    cache.set(lastScanKey, Date.now(), 2 * 3600);       // mark last scan time
    logger.info(`Pronostics: ${pronostics.length} returned (top10=${top10.length}, lite-scanned=${remaining.length}, VB candidates=${cappedCandidates.length})`);
    return pronostics;
  }

  /**
   * Lite scan: fetch ONLY the odds for each fixture and run Shin's method.
   * Returns the fixtures that have at least one Shin value bet detected.
   * Outbound throttler ensures we don't burst — typically 50-100 fixtures
   * paced at ~240ms = 12-24 sec total wall time.
   */
  async _liteScanForValueBets(fixtures) {
    const candidates = [];
    for (const f of fixtures) {
      try {
        const oddsData = await api.getOddsByFixture(f.fixture.id);
        const oddsRaw = oddsData.response?.[0];
        if (!oddsRaw) continue;
        const oddsAnalysis = analysisService.analyzeFixtureOdds(oddsRaw);
        if (oddsAnalysis?.valueBets?.length > 0) {
          candidates.push(f);
        }
      } catch (e) {
        // Single fixture failure is fine — keep scanning the others
      }
    }
    return candidates;
  }

  async _analyzeBatch(fixtures, opts) {
    if (fixtures.length === 0) return [];
    const results = await Promise.allSettled(
      fixtures.map((f) => this._fetchAnalysis(f, opts)),
    );
    return results;
  }

  /** Build pronostic objects from raw analyses + filter unreliable upstream data. */
  _buildPronostics(fixtures, analyses) {
    return analyses
      .map((result, i) => {
        if (result.status !== 'fulfilled' || !result.value) return null;
        const { oddsAnalysis, predAnalysis: rawPred } = result.value;
        // Predictions API can return wonky percentages on lopsided fixtures
        // (e.g. home=0% / away=95%) or leagues with sparse data — that flips
        // probabilitiesReliable to false. Previously we dropped the match
        // entirely, which silenced Shin value bets that the bookmaker odds
        // alone fully justify. Now we degrade to odds-only when predictions
        // are unreliable, so the VB still surfaces.
        const predAnalysis = (rawPred && rawPred.probabilitiesReliable === false)
          ? null
          : rawPred;
        if (!predAnalysis && !oddsAnalysis) return null;
        const fixture = fixtures[i];
        const fullAnalysis = analysisService.buildFullAnalysis(oddsAnalysis, predAnalysis, fixture);
        const confidence = this._calculateConfidence(predAnalysis, oddsAnalysis);
        let pick = this._selectBestPick(fullAnalysis, fixture);
        // If no pick was selected but the match has at least one Shin value
        // bet, synthesise a pick from the top VB so the match still shows.
        // Without this fallback, a non-1X2 VB on a clear-favorite match
        // (e.g. BTTS on PSG-Bayern) would silently drop the entire match
        // because _selectBestPick prefers a 1X2 pick that doesn't exist.
        if (!pick) {
          const vbs = oddsAnalysis?.valueBets || [];
          if (vbs.length > 0) {
            const top = vbs[0];
            pick = {
              market: top.market,
              selection: top.selection,
              selectionLabel: this._selectionLabel(top.selection, fixture.teams?.home?.name, fixture.teams?.away?.name),
              probability: top.trueProb ?? top.prob,
              odd: top.odd,
              isValue: true,
              edge: top.edge,
            };
          }
        }
        if (!pick) return null;
        return { fixture, analysis: fullAnalysis, confidence, pick };
      })
      .filter(Boolean);
  }

  async _fetchAnalysis(fixture, opts = {}) {
    const { full = false } = opts;
    const fixtureId = fixture.fixture?.id;
    const homeId = fixture.teams?.home?.id;
    const awayId = fixture.teams?.away?.id;
    const leagueId = fixture.league?.id;
    const season = fixture.league?.season;

    // 'lite' mode (default for the home Top 10): only odds + predictions to
    // keep total parallel API calls per request manageable. With 10 fixtures,
    // that's 20 calls instead of 60 — well within API-Football rate limits.
    // 'full' mode adds team stats + lineups + top scorers (used by /api/
    // analysis/fixture/:id which is per-match, not in a batch of 10).
    const tasks = [
      api.getOddsByFixture(fixtureId),
      api.getPredictions(fixtureId),
    ];
    const hasTeamCtx = homeId && awayId && leagueId && season;
    if (full && hasTeamCtx) {
      tasks.push(
        api.getTeamStatistics(homeId, season, leagueId),
        api.getTeamStatistics(awayId, season, leagueId),
        api.getFixtureLineups(fixtureId),
        api.getTopScorers(leagueId, season),
      );
    }

    const results = await Promise.allSettled(tasks);
    const [oddsData, predData, homeStatsData, awayStatsData, lineupsData, scorersData] = results;

    const oddsRaw = oddsData.status === 'fulfilled' ? oddsData.value.response?.[0] : null;
    const predRaw = predData.status === 'fulfilled' ? predData.value.response?.[0] : null;

    let teamStats = null;
    let lineupContext = null;
    if (full && hasTeamCtx) {
      const extractStats = (settled) => {
        if (!settled || settled.status !== 'fulfilled') return null;
        const resp = settled.value.response;
        if (Array.isArray(resp)) return resp.length > 0 ? resp[0] : null;
        return resp && typeof resp === 'object' ? resp : null;
      };
      teamStats = {
        home: extractStats(homeStatsData),
        away: extractStats(awayStatsData),
      };
      const lineups = lineupsData?.status === 'fulfilled' ? (lineupsData.value.response || []) : [];
      const topScorers = scorersData?.status === 'fulfilled' ? (scorersData.value.response || []) : [];
      lineupContext = this._computeLineupContext(lineups, topScorers, homeId, awayId);
    }

    // Each analysis step is isolated — a bug in predictions analysis must
    // never silently drop a match whose bookmaker odds yielded a clean Shin
    // value bet. Same logic for the cross-source enrichment.
    let oddsAnalysis = null;
    if (oddsRaw) {
      try {
        oddsAnalysis = analysisService.analyzeFixtureOdds(oddsRaw);
      } catch (e) {
        logger.warn(`analyzeFixtureOdds failed for fixture ${fixtureId}: ${e.message}`);
      }
    }

    let predAnalysis = null;
    if (predRaw) {
      try {
        predAnalysis = analysisService.analyzePredictions(predRaw, teamStats, lineupContext);
      } catch (e) {
        logger.warn(`analyzePredictions failed for fixture ${fixtureId}: ${e.message}`);
      }
    }

    if (oddsAnalysis && predAnalysis?.expectedGoals) {
      try {
        analysisService.enrichValueBetsWithSources(oddsAnalysis, predAnalysis);
      } catch (e) {
        logger.warn(`enrichValueBetsWithSources failed for fixture ${fixtureId}: ${e.message}`);
      }
    }

    return { oddsAnalysis, predAnalysis };
  }

  /**
   * Detect whether a top-5 league scorer is absent from a team's starting XI.
   * If so we'll downscale that team's xG by a calibrated amount.
   * Returns { home: { absentTopScorer, xgPenalty }, away: { ... } } or null
   * if lineups/scorers aren't available yet.
   */
  _computeLineupContext(lineups, topScorers, homeId, awayId) {
    if (!lineups?.length || !topScorers?.length) return null;

    const startXIs = {};
    lineups.forEach((lu) => {
      const teamId = lu.team?.id;
      if (!teamId) return;
      const ids = (lu.startXI || []).map((p) => p.player?.id).filter(Boolean);
      startXIs[teamId] = ids;
    });

    const teamScorers = { home: [], away: [] };
    topScorers.slice(0, 10).forEach((entry) => {
      const playerId = entry.player?.id;
      const playerName = entry.player?.name;
      const goals = entry.statistics?.[0]?.goals?.total ?? 0;
      const teamId = entry.statistics?.[0]?.team?.id;
      if (!playerId || !teamId) return;
      if (teamId === homeId) teamScorers.home.push({ playerId, playerName, goals });
      if (teamId === awayId) teamScorers.away.push({ playerId, playerName, goals });
    });

    const buildSide = (teamId, scorers) => {
      const xi = startXIs[teamId];
      if (!xi || !scorers.length) return null;
      const top = scorers[0];
      const isStarting = xi.includes(top.playerId);
      if (isStarting) return { absentTopScorer: null, xgPenalty: 0 };
      // Penalty proportional to share of team goals — capped at 25%
      // Safe default of 15% when we don't know the team's total goals.
      const penalty = 0.15;
      return {
        absentTopScorer: { name: top.playerName, goals: top.goals },
        xgPenalty: penalty,
      };
    };

    return {
      home: buildSide(homeId, teamScorers.home),
      away: buildSide(awayId, teamScorers.away),
    };
  }

  /**
   * Real confidence index (0-100) based on 6 independent factors:
   *
   * A. Probability decisiveness  (0-35 pts) — how dominant is the leading outcome?
   * B. Probability gap            (0-20 pts) — spread between 1st and 2nd outcome
   * C. Model agreement            (0-15 pts) — Poisson xG model vs bookmaker fair probs
   * D. Market quality / overround (0-10 pts) — tight market = confident bookmakers
   * E. Recent form of winner      (0-12 pts) — last-5 win rate for the predicted side
   * F. H2H historical support     (0-8  pts) — historical head-to-head backing
   */
  _calculateConfidence(predAnalysis, oddsAnalysis) {
    const probs = predAnalysis?.probabilities ?? oddsAnalysis?.matchWinner?.fairProbs;
    if (!probs) return 30;

    let score = 0;
    const pH = probs.home || 0;
    const pD = probs.draw || 0;
    const pA = probs.away || 0;
    const maxProb = Math.max(pH, pD, pA);

    // A — Probability decisiveness
    if (maxProb >= 70) score += 35;
    else if (maxProb >= 62) score += 28;
    else if (maxProb >= 55) score += 20;
    else if (maxProb >= 48) score += 13;
    else score += Math.round(maxProb * 0.2);

    // B — Gap between 1st and 2nd highest probability
    const [first, second] = [pH, pD, pA].sort((a, b) => b - a);
    const gap = first - second;
    if (gap >= 30) score += 20;
    else if (gap >= 20) score += 16;
    else if (gap >= 13) score += 11;
    else if (gap >= 7) score += 6;
    else score += 2;

    // C — Model agreement: prediction API vs bookmaker fair probabilities
    const fairProbs = oddsAnalysis?.matchWinner?.fairProbs;
    if (fairProbs) {
      const predWinner = maxProb === pH ? 'home' : maxProb === pA ? 'away' : 'draw';
      const fMax = Math.max(fairProbs.home || 0, fairProbs.draw || 0, fairProbs.away || 0);
      const oddsWinner = fMax === fairProbs.home ? 'home' : fMax === fairProbs.away ? 'away' : 'draw';
      score += predWinner === oddsWinner ? 15 : 0;
    } else {
      score += 6; // neutral — no bookmaker data available
    }

    // D — Overround quality (low overround = bookmakers are decisive/confident)
    const overround = oddsAnalysis?.matchWinner?.overround;
    if (overround !== undefined && overround !== null) {
      if (overround < 5) score += 10;
      else if (overround < 8) score += 8;
      else if (overround < 12) score += 5;
      else score += 2;
    } else {
      score += 4; // neutral
    }

    // E — Recent form of the predicted winner (last 5 games)
    const form = predAnalysis?.form;
    const predWinner = maxProb === pH ? 'home' : maxProb === pA ? 'away' : null;
    if (predWinner && form?.[predWinner]) {
      const wins = form[predWinner].filter((f) => f.win).length;
      if (wins >= 4) score += 12;
      else if (wins >= 3) score += 8;
      else if (wins >= 2) score += 5;
      else score += 2;
    } else {
      score += 5; // draw predicted or no form data
    }

    // F — H2H historical support
    const h2h = predAnalysis?.h2h;
    if (h2h?.played >= 3) {
      const winner = maxProb === pH ? 'home' : maxProb === pA ? 'away' : 'draw';
      const supporting =
        winner === 'home' ? h2h.homeWins : winner === 'away' ? h2h.awayWins : h2h.draws;
      const rate = supporting / h2h.played;
      if (rate >= 0.55) score += 8;
      else if (rate >= 0.35) score += 5;
      else score += 1;
    } else {
      score += 3; // insufficient h2h data
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  _selectBestPick(fullAnalysis, fixture) {
    const { odds, predictions } = fullAnalysis;
    const home = fixture.teams?.home;
    const away = fixture.teams?.away;

    // Determine if 1X2 has a clear favourite (≥50% fair probability)
    const fairProbs = odds?.matchWinner?.fairProbs;
    const max1x2Prob = fairProbs
      ? Math.max(fairProbs.home || 0, fairProbs.draw || 0, fairProbs.away || 0)
      : 0;
    const hasClearFavourite = max1x2Prob >= 50;

    // Value bets: 1X2 value bets always shown; secondary market (BTTS/O/U) only
    // when no clear 1X2 favourite exists — avoids "Score vierge" eclipsing Chelsea 70%
    if (odds?.valueBets?.length > 0) {
      const top1x2 = odds.valueBets.find((v) => v.market === '1X2');
      const topAny = odds.valueBets[0];
      const top = top1x2 || (!hasClearFavourite ? topAny : null);
      if (top) {
        return {
          market: top.market,
          selection: top.selection,
          selectionLabel: this._selectionLabel(top.selection, home?.name, away?.name),
          // detectValueBet exposes trueProb (not prob) — fall back to prob
          // for safety if the upstream contract ever changes.
          probability: top.trueProb ?? top.prob,
          odd: top.odd,
          isValue: true,
          edge: top.edge,
        };
      }
    }

    // Fall back to the highest-probability bet from odds analysis
    if (odds?.bestBet) {
      const bet = odds.bestBet;
      return {
        market: bet.market,
        selection: bet.selection,
        selectionLabel: this._selectionLabel(bet.selection, home?.name, away?.name),
        probability: bet.prob,
        odd: bet.odd,
        isValue: false,
        edge: null,
      };
    }

    // Last resort: prediction model only
    const probs = predictions?.probabilities;
    if (!probs) return null;

    const max = Math.max(probs.home || 0, probs.draw || 0, probs.away || 0);
    const outcome = max === probs.home ? 'home' : max === probs.away ? 'away' : 'draw';
    const selection = outcome === 'home' ? '1' : outcome === 'draw' ? 'X' : '2';

    return {
      market: '1X2',
      selection,
      selectionLabel: this._selectionLabel(selection, home?.name, away?.name),
      probability: max,
      odd: null,
      isValue: false,
      edge: null,
    };
  }

  _selectionLabel(selection, homeName, awayName) {
    const map = {
      '1': homeName || 'Domicile',
      'X': 'Match nul',
      '2': awayName || 'Extérieur',
      'Over 2.5': 'Plus de 2.5 buts',
      'Under 2.5': 'Moins de 2.5 buts',
      'Over 1.5': 'Plus de 1.5 buts',
      'Under 1.5': 'Moins de 1.5 buts',
      'Over 3.5': 'Plus de 3.5 buts',
      'Under 3.5': 'Moins de 3.5 buts',
      'Oui': 'Les deux équipes marquent',
      'Non': 'Score vierge',
    };
    return map[selection] || selection;
  }
}

module.exports = new PronosticsService();
