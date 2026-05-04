const {
  oddsToImpliedProb,
  removeMarginShin,
  removeMarginSimple,
  calculateOverround,
  detectValueBet,
  kellyCriterion,
  generateScoreMatrix,
  getConfidenceLevel,
} = require('../utils/probabilityCalc');

class AnalysisService {
  /**
   * Full analysis of a fixture's odds
   */
  analyzeFixtureOdds(oddsData) {
    if (!oddsData?.bookmakers?.length) return null;

    const allMarkets = this._aggregateMarkets(oddsData.bookmakers);
    const analysis = {};

    // 1x2 market
    if (allMarkets['Match Winner']) {
      analysis.matchWinner = this._analyze1x2(allMarkets['Match Winner']);
    }

    // Over/Under 2.5
    if (allMarkets['Goals Over/Under']) {
      analysis.goalsOverUnder = this._analyzeOverUnder(allMarkets['Goals Over/Under']);
    }

    // BTTS
    if (allMarkets['Both Teams Score']) {
      analysis.btts = this._analyzeBTTS(allMarkets['Both Teams Score']);
    }

    // Double Chance
    if (allMarkets['Double Chance']) {
      analysis.doubleChance = this._analyzeDoubleChance(allMarkets['Double Chance']);
    }

    // Exact Score
    if (allMarkets['Exact Score']) {
      analysis.exactScore = this._analyzeExactScore(allMarkets['Exact Score']);
    }

    // HT/FT
    if (allMarkets['HT/FT Double']) {
      analysis.htFt = this._analyzeHTFT(allMarkets['HT/FT Double']);
    }

    // Handicap
    if (allMarkets['Asian Handicap']) {
      analysis.handicap = this._analyzeHandicap(allMarkets['Asian Handicap']);
    }

    analysis.bestBet = this._findBestBet(analysis);
    analysis.valueBets = this._findValueBets(analysis);
    analysis.marketAnomaly = this._detectMarketAnomaly(allMarkets);
    analysis.summary = this._generateSummary(analysis);

    return analysis;
  }

  /**
   * Analyze predictions from API
   */
  analyzePredictions(predictionData) {
    if (!predictionData) return null;

    const { predictions, teams, comparison, league, h2h } = predictionData;

    const homeWinProb = parseFloat(predictions?.percent?.home?.replace('%', '') || 0);
    const drawProb = parseFloat(predictions?.percent?.draw?.replace('%', '') || 0);
    const awayWinProb = parseFloat(predictions?.percent?.away?.replace('%', '') || 0);

    const recommendedWinner = predictions?.winner?.name || null;
    const advice = predictions?.advice || '';

    const homeForm = this._parseFormString(teams?.home?.last_5?.form || '');
    const awayForm = this._parseFormString(teams?.away?.last_5?.form || '');

    const h2hAnalysis = this._analyzeH2H(h2h || []);

    const goalsComparison = {
      home: {
        attack: parseFloat(comparison?.att?.home?.replace('%', '') || 0),
        defense: parseFloat(comparison?.def?.home?.replace('%', '') || 0),
        form: parseFloat(comparison?.form?.home?.replace('%', '') || 0),
        avgGoals: teams?.home?.last_5?.goals?.for?.average || 0,
        avgConceded: teams?.home?.last_5?.goals?.against?.average || 0,
      },
      away: {
        attack: parseFloat(comparison?.att?.away?.replace('%', '') || 0),
        defense: parseFloat(comparison?.def?.away?.replace('%', '') || 0),
        form: parseFloat(comparison?.form?.away?.replace('%', '') || 0),
        avgGoals: teams?.away?.last_5?.goals?.for?.average || 0,
        avgConceded: teams?.away?.last_5?.goals?.against?.average || 0,
      },
    };

    const homeExpectedGoals = this._calcExpectedGoals(goalsComparison.home, goalsComparison.away);
    const awayExpectedGoals = this._calcExpectedGoals(goalsComparison.away, goalsComparison.home);

    const scoreMatrix = generateScoreMatrix(homeExpectedGoals, awayExpectedGoals);
    const mostLikelyScores = scoreMatrix.slice(0, 5);

    return {
      probabilities: {
        home: homeWinProb,
        draw: drawProb,
        away: awayWinProb,
        confidence: getConfidenceLevel(Math.max(homeWinProb, drawProb, awayWinProb)),
      },
      recommendation: {
        winner: recommendedWinner,
        advice,
        confidence: this._calcRecommendationConfidence(homeWinProb, drawProb, awayWinProb),
      },
      form: { home: homeForm, away: awayForm },
      goalsComparison,
      expectedGoals: {
        home: parseFloat(homeExpectedGoals.toFixed(2)),
        away: parseFloat(awayExpectedGoals.toFixed(2)),
        total: parseFloat((homeExpectedGoals + awayExpectedGoals).toFixed(2)),
      },
      mostLikelyScores,
      h2h: h2hAnalysis,
      raw: predictionData,
    };
  }

  /**
   * Combined analysis merging odds + predictions
   */
  buildFullAnalysis(oddsAnalysis, predictionAnalysis, fixtureData) {
    const result = {
      fixture: fixtureData,
      predictions: predictionAnalysis,
      odds: oddsAnalysis,
      timestamp: new Date().toISOString(),
    };

    if (oddsAnalysis?.matchWinner && predictionAnalysis?.probabilities) {
      const { home: oddsHome, draw: oddsDraw, away: oddsAway } = oddsAnalysis.matchWinner.fairProbs;
      const { home: predHome, draw: predDraw, away: predAway } = predictionAnalysis.probabilities;

      result.consensusProbs = {
        home: parseFloat(((oddsHome + predHome) / 2).toFixed(1)),
        draw: parseFloat(((oddsDraw + predDraw) / 2).toFixed(1)),
        away: parseFloat(((oddsAway + predAway) / 2).toFixed(1)),
      };
    }

    return result;
  }

  // ─── Private: Market Aggregation ──────────────────────────────────────────
  _aggregateMarkets(bookmakers) {
    const markets = {};

    bookmakers.forEach((bk) => {
      bk.bets?.forEach((bet) => {
        if (!markets[bet.name]) markets[bet.name] = {};
        bet.values?.forEach((v) => {
          if (!markets[bet.name][v.value]) markets[bet.name][v.value] = [];
          markets[bet.name][v.value].push(parseFloat(v.odd));
        });
      });
    });

    // Average odds across bookmakers
    Object.keys(markets).forEach((market) => {
      Object.keys(markets[market]).forEach((outcome) => {
        const odds = markets[market][outcome];
        markets[market][outcome] = {
          avg: odds.reduce((a, b) => a + b, 0) / odds.length,
          max: Math.max(...odds),
          min: Math.min(...odds),
          count: odds.length,
        };
      });
    });

    return markets;
  }

  _analyze1x2(market) {
    const homeOdd = market['Home']?.avg || market['1']?.avg;
    const drawOdd = market['Draw']?.avg || market['X']?.avg;
    const awayOdd = market['Away']?.avg || market['2']?.avg;

    if (!homeOdd || !drawOdd || !awayOdd) return null;

    const [homeFair, drawFair, awayFair] = removeMarginShin([homeOdd, drawOdd, awayOdd]);
    const overround = calculateOverround([homeOdd, drawOdd, awayOdd]);

    const homeValue = detectValueBet(homeFair, homeOdd);
    const drawValue = detectValueBet(drawFair, drawOdd);
    const awayValue = detectValueBet(awayFair, awayOdd);

    return {
      odds: { home: homeOdd, draw: drawOdd, away: awayOdd },
      maxOdds: {
        home: market['Home']?.max || market['1']?.max,
        draw: market['Draw']?.max || market['X']?.max,
        away: market['Away']?.max || market['2']?.max,
      },
      fairProbs: { home: parseFloat(homeFair.toFixed(1)), draw: parseFloat(drawFair.toFixed(1)), away: parseFloat(awayFair.toFixed(1)) },
      impliedProbs: {
        home: parseFloat(oddsToImpliedProb(homeOdd).toFixed(1)),
        draw: parseFloat(oddsToImpliedProb(drawOdd).toFixed(1)),
        away: parseFloat(oddsToImpliedProb(awayOdd).toFixed(1)),
      },
      overround,
      valueBets: { home: homeValue, draw: drawValue, away: awayValue },
      kelly: {
        home: kellyCriterion(homeFair, homeOdd),
        draw: kellyCriterion(drawFair, drawOdd),
        away: kellyCriterion(awayFair, awayOdd),
      },
    };
  }

  _analyzeOverUnder(market) {
    const lines = {};
    const lineTargets = ['Over 2.5', 'Under 2.5', 'Over 1.5', 'Under 1.5', 'Over 3.5', 'Under 3.5'];

    lineTargets.forEach((key) => {
      if (market[key]) {
        const [type, val] = key.split(' ');
        if (!lines[val]) lines[val] = {};
        const odd = market[key].avg;
        lines[val][type.toLowerCase()] = {
          odd,
          impliedProb: parseFloat(oddsToImpliedProb(odd).toFixed(1)),
        };
      }
    });

    // Fair probs for 2.5
    if (lines['2.5']?.over && lines['2.5']?.under) {
      const [overFair, underFair] = removeMarginShin([lines['2.5'].over.odd, lines['2.5'].under.odd]);
      lines['2.5'].over.fairProb = parseFloat(overFair.toFixed(1));
      lines['2.5'].under.fairProb = parseFloat(underFair.toFixed(1));
      lines['2.5'].over.valueInfo = detectValueBet(overFair, lines['2.5'].over.odd);
      lines['2.5'].under.valueInfo = detectValueBet(underFair, lines['2.5'].under.odd);
    }

    return { lines };
  }

  _analyzeBTTS(market) {
    const yesOdd = market['Yes']?.avg;
    const noOdd = market['No']?.avg;
    if (!yesOdd || !noOdd) return null;

    const [yesFair, noFair] = removeMarginShin([yesOdd, noOdd]);
    return {
      odds: { yes: yesOdd, no: noOdd },
      fairProbs: { yes: parseFloat(yesFair.toFixed(1)), no: parseFloat(noFair.toFixed(1)) },
      valueBets: {
        yes: detectValueBet(yesFair, yesOdd),
        no: detectValueBet(noFair, noOdd),
      },
    };
  }

  _analyzeDoubleChance(market) {
    const homeDrawOdd = market['Home/Draw']?.avg;
    const homeAwayOdd = market['Home/Away']?.avg;
    const drawAwayOdd = market['Draw/Away']?.avg;

    const result = {};
    if (homeDrawOdd) result.homeDraw = { odd: homeDrawOdd, prob: parseFloat(oddsToImpliedProb(homeDrawOdd).toFixed(1)) };
    if (homeAwayOdd) result.homeAway = { odd: homeAwayOdd, prob: parseFloat(oddsToImpliedProb(homeAwayOdd).toFixed(1)) };
    if (drawAwayOdd) result.drawAway = { odd: drawAwayOdd, prob: parseFloat(oddsToImpliedProb(drawAwayOdd).toFixed(1)) };

    return result;
  }

  _analyzeExactScore(market) {
    const scores = Object.entries(market).map(([score, data]) => ({
      score,
      odd: data.avg,
      prob: parseFloat(oddsToImpliedProb(data.avg).toFixed(2)),
    }));
    return scores.sort((a, b) => b.prob - a.prob).slice(0, 10);
  }

  _analyzeHTFT(market) {
    const outcomes = Object.entries(market).map(([outcome, data]) => ({
      outcome,
      odd: data.avg,
      prob: parseFloat(oddsToImpliedProb(data.avg).toFixed(1)),
    }));
    return outcomes.sort((a, b) => b.prob - a.prob);
  }

  _analyzeHandicap(market) {
    return Object.entries(market).map(([outcome, data]) => ({
      outcome,
      odd: data.avg,
      prob: parseFloat(oddsToImpliedProb(data.avg).toFixed(1)),
    }));
  }

  _findBestBet(analysis) {
    // 1X2 is always the primary pick when there is a clear favourite
    if (analysis.matchWinner) {
      const { fairProbs, odds } = analysis.matchWinner;
      const maxProb = Math.max(fairProbs.home, fairProbs.draw, fairProbs.away);
      const outcome = maxProb === fairProbs.home ? 'home' : maxProb === fairProbs.draw ? 'draw' : 'away';
      const label = outcome === 'home' ? '1' : outcome === 'draw' ? 'X' : '2';

      // If 1X2 has a clear favourite (≥50%), return it directly — never let secondary
      // markets (O/U, BTTS) override a decisive signal like Chelsea 70%
      if (maxProb >= 50) {
        return {
          market: '1X2',
          selection: label,
          prob: maxProb,
          odd: odds[outcome],
          confidence: getConfidenceLevel(maxProb),
        };
      }
    }

    // Only compare secondary markets when 1X2 is genuinely uncertain (<50%)
    const candidates = [];

    if (analysis.matchWinner) {
      const { fairProbs, odds } = analysis.matchWinner;
      const maxProb = Math.max(fairProbs.home, fairProbs.draw, fairProbs.away);
      const outcome = maxProb === fairProbs.home ? 'home' : maxProb === fairProbs.draw ? 'draw' : 'away';
      const label = outcome === 'home' ? '1' : outcome === 'draw' ? 'X' : '2';
      candidates.push({ market: '1X2', selection: label, prob: maxProb, odd: odds[outcome], confidence: getConfidenceLevel(maxProb) });
    }

    if (analysis.goalsOverUnder?.lines['2.5']) {
      const { over, under } = analysis.goalsOverUnder.lines['2.5'];
      const best = (over?.fairProb || 0) > (under?.fairProb || 0) ? over : under;
      const label = best === over ? 'Over 2.5' : 'Under 2.5';
      candidates.push({ market: 'O/U 2.5', selection: label, prob: best.fairProb, odd: best.odd, confidence: getConfidenceLevel(best.fairProb) });
    }

    if (analysis.btts) {
      const { fairProbs, odds } = analysis.btts;
      const best = fairProbs.yes > fairProbs.no ? 'yes' : 'no';
      candidates.push({ market: 'BTTS', selection: best === 'yes' ? 'Oui' : 'Non', prob: fairProbs[best], odd: odds[best], confidence: getConfidenceLevel(fairProbs[best]) });
    }

    return candidates.sort((a, b) => b.prob - a.prob)[0] || null;
  }

  _findValueBets(analysis) {
    const valueBets = [];

    if (analysis.matchWinner?.valueBets) {
      const { home, draw, away } = analysis.matchWinner.valueBets;
      const odds = analysis.matchWinner.odds;
      if (home?.isValue) valueBets.push({ market: '1X2', selection: '1', ...home, odd: odds.home });
      if (draw?.isValue) valueBets.push({ market: '1X2', selection: 'X', ...draw, odd: odds.draw });
      if (away?.isValue) valueBets.push({ market: '1X2', selection: '2', ...away, odd: odds.away });
    }

    if (analysis.btts?.valueBets) {
      const { yes, no } = analysis.btts.valueBets;
      const odds = analysis.btts.odds;
      if (yes?.isValue) valueBets.push({ market: 'BTTS', selection: 'Oui', ...yes, odd: odds.yes });
      if (no?.isValue) valueBets.push({ market: 'BTTS', selection: 'Non', ...no, odd: odds.no });
    }

    if (analysis.goalsOverUnder?.lines['2.5']) {
      const { over, under } = analysis.goalsOverUnder.lines['2.5'];
      if (over?.valueInfo?.isValue) valueBets.push({ market: 'O/U 2.5', selection: 'Over 2.5', ...over.valueInfo, odd: over.odd });
      if (under?.valueInfo?.isValue) valueBets.push({ market: 'O/U 2.5', selection: 'Under 2.5', ...under.valueInfo, odd: under.odd });
    }

    return valueBets.sort((a, b) => b.edge - a.edge);
  }

  _detectMarketAnomaly(markets) {
    const anomalies = [];
    const mw = markets['Match Winner'];
    if (!mw) return anomalies;

    const homeData = mw['Home'] || mw['1'];
    const awayData = mw['Away'] || mw['2'];

    if (homeData && awayData) {
      const spread = Math.abs(homeData.max - homeData.min);
      if (spread > 0.3) {
        anomalies.push({ type: 'high-spread', market: '1X2', outcome: 'home', spread: parseFloat(spread.toFixed(3)) });
      }
    }

    return anomalies;
  }

  _generateSummary(analysis) {
    const parts = [];
    if (analysis.bestBet) {
      parts.push(`Meilleur pari: ${analysis.bestBet.market} — ${analysis.bestBet.selection} @ ${analysis.bestBet.odd?.toFixed(2)} (${analysis.bestBet.prob?.toFixed(0)}%)`);
    }
    if (analysis.valueBets?.length > 0) {
      parts.push(`${analysis.valueBets.length} value bet(s) détecté(s)`);
    }
    return parts.join(' · ');
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  _parseFormString(form) {
    if (!form) return [];
    return form.split('').map((c) => ({
      result: c,
      win: c === 'W',
      draw: c === 'D',
      loss: c === 'L',
    }));
  }

  _analyzeH2H(h2hFixtures) {
    if (!h2hFixtures.length) return null;
    let homeWins = 0, awayWins = 0, draws = 0;
    let totalGoals = 0;
    const recent = h2hFixtures.slice(0, 10);

    recent.forEach((f) => {
      const hg = f.goals?.home ?? 0;
      const ag = f.goals?.away ?? 0;
      totalGoals += hg + ag;
      if (hg > ag) homeWins++;
      else if (ag > hg) awayWins++;
      else draws++;
    });

    return {
      played: recent.length,
      homeWins,
      awayWins,
      draws,
      avgGoals: parseFloat((totalGoals / recent.length).toFixed(2)),
    };
  }

  _calcExpectedGoals(team, opponent) {
    // parseFloat handles string "0" from API (which is truthy, bypassing || fallback)
    const attack = parseFloat(team.avgGoals) || 1.2;
    const conceded = parseFloat(opponent.avgConceded) || 1.2;
    const attackStrength = attack / 1.4;
    const defenseWeakness = conceded / 1.2;
    return Math.max(0.3, attackStrength * defenseWeakness * 1.4);
  }

  _calcRecommendationConfidence(home, draw, away) {
    const max = Math.max(home, draw, away);
    const second = [home, draw, away].sort((a, b) => b - a)[1];
    const gap = max - second;
    return parseFloat(Math.min(95, max + gap * 0.5).toFixed(1));
  }
}

module.exports = new AnalysisService();
