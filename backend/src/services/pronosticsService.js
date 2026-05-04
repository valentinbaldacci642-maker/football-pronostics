const api = require('./apiFootball');
const analysisService = require('./analysisService');
const cache = require('../utils/cache');
const logger = require('../utils/logger');

// Leagues ranked by prestige/data quality
const PRIORITY_LEAGUES = [2, 3, 39, 140, 135, 61, 78, 88, 94, 253, 307, 45, 48, 71, 128];

class PronosticsService {
  async getBestPronostics(forceRefresh = false) {
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = cache.buildKey('pronostics', today);

    if (!forceRefresh) {
      const cached = cache.get(cacheKey);
      if (cached && cached.length > 0) return cached;
    }

    let fixtures = [];
    try {
      const res = await api.getFixturesByDate(today, null, null);
      fixtures = res.response || [];
    } catch (e) {
      logger.error('PronosticsService: failed to get fixtures', e.message);
      return [];
    }

    // Only upcoming, sorted by league priority, capped at 8 to limit API quota usage
    const upcoming = fixtures
      .filter((f) => ['NS', 'TBD'].includes(f.fixture?.status?.short))
      .sort((a, b) => {
        const pa = PRIORITY_LEAGUES.indexOf(a.league?.id);
        const pb = PRIORITY_LEAGUES.indexOf(b.league?.id);
        return (pa === -1 ? 999 : pa) - (pb === -1 ? 999 : pb);
      })
      .slice(0, 8);

    if (upcoming.length === 0) return [];

    // Fetch predictions + odds in parallel for all selected fixtures
    const analyses = await Promise.allSettled(
      upcoming.map((f) => this._fetchAnalysis(f.fixture.id))
    );

    const all = analyses
      .map((result, i) => {
        if (result.status !== 'fulfilled' || !result.value) return null;
        const { oddsAnalysis, predAnalysis } = result.value;
        if (!predAnalysis && !oddsAnalysis) return null;

        const fixture = upcoming[i];
        const fullAnalysis = analysisService.buildFullAnalysis(oddsAnalysis, predAnalysis, fixture);
        const confidence = this._calculateConfidence(predAnalysis, oddsAnalysis);
        const pick = this._selectBestPick(fullAnalysis, fixture);

        if (!pick) return null;

        return { fixture, analysis: fullAnalysis, confidence, pick };
      })
      .filter(Boolean)
      .sort((a, b) => b.confidence - a.confidence);

    // Prefer high-confidence picks; if none pass threshold, show best available
    const reliable = all.filter((p) => p.confidence >= 45).slice(0, 8);
    const pronostics = reliable.length > 0 ? reliable : all.slice(0, 3);

    cache.set(cacheKey, pronostics, 10800); // 3h cache
    return pronostics;
  }

  async _fetchAnalysis(fixtureId) {
    const [oddsData, predData] = await Promise.allSettled([
      api.getOddsByFixture(fixtureId),
      api.getPredictions(fixtureId),
    ]);

    const oddsRaw = oddsData.status === 'fulfilled' ? oddsData.value.response?.[0] : null;
    const predRaw = predData.status === 'fulfilled' ? predData.value.response?.[0] : null;

    return {
      oddsAnalysis: oddsRaw ? analysisService.analyzeFixtureOdds(oddsRaw) : null,
      predAnalysis: predRaw ? analysisService.analyzePredictions(predRaw) : null,
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
          probability: top.prob,
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
