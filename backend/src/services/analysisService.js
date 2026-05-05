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

    // Player props — Anytime Goalscorer is the most universally available
    const goalscorerMarket =
      allMarkets['Anytime Goalscorer'] ||
      allMarkets['Goalscorer Anytime'] ||
      allMarkets['Player Goal'];
    if (goalscorerMarket) {
      analysis.anytimeGoalscorer = this._analyzePlayerMarket(goalscorerMarket);
    }
    const firstScorerMarket =
      allMarkets['First Goalscorer'] || allMarkets['Goalscorer First'];
    if (firstScorerMarket) {
      analysis.firstGoalscorer = this._analyzePlayerMarket(firstScorerMarket);
    }

    analysis.bestBet = this._findBestBet(analysis);
    analysis.valueBets = this._findValueBets(analysis);
    analysis.marketAnomaly = this._detectMarketAnomaly(allMarkets);
    analysis.summary = this._generateSummary(analysis);

    return analysis;
  }

  /**
   * Analyze predictions from API
   * @param {object} predictionData - raw API prediction response
   * @param {object} [teamStats] - optional season-wide stats { home, away } from /teams/statistics
   * @param {object} [lineupContext] - optional { home, away } { absentTopScorer, xgPenalty }
   *                                   from /fixtures/lineups + /players/topscorers
   */
  analyzePredictions(predictionData, teamStats = null, lineupContext = null) {
    if (!predictionData) return null;

    const { predictions, teams, comparison, league, h2h } = predictionData;

    // Sanitize API percent fields — null/missing data must NOT silently become 0,
    // otherwise an asymmetric response (e.g. home=null, away="100%") yields a wildly
    // skewed probability distribution that pollutes consensusProbs and the pick.
    const homeWinProb = this._parsePercent(predictions?.percent?.home);
    const drawProb = this._parsePercent(predictions?.percent?.draw);
    const awayWinProb = this._parsePercent(predictions?.percent?.away);

    const allPresent = homeWinProb !== null && drawProb !== null && awayWinProb !== null;
    const sum = (homeWinProb || 0) + (drawProb || 0) + (awayWinProb || 0);
    const probabilitiesReliable = allPresent && Math.abs(sum - 100) <= 5;

    const probabilities = probabilitiesReliable
      ? {
          home: homeWinProb,
          draw: drawProb,
          away: awayWinProb,
          confidence: getConfidenceLevel(Math.max(homeWinProb, drawProb, awayWinProb)),
        }
      : null;

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

    // Full-season xG only — no last_5 fallback (explicit product requirement)
    // Venue-adjusted: home team uses its home scoring rate vs away team's away conceding rate
    const homeSeason = this._extractSeasonGoals(teamStats?.home);
    const awaySeason = this._extractSeasonGoals(teamStats?.away);
    let homeExpectedGoals = this._calcExpectedGoals(homeSeason, awaySeason, 'home');
    let awayExpectedGoals = this._calcExpectedGoals(awaySeason, homeSeason, 'away');

    // Lineup-aware adjustment: if a top scorer is on the bench / out, scale that team's xG down
    const homePenalty = lineupContext?.home?.xgPenalty || 0;
    const awayPenalty = lineupContext?.away?.xgPenalty || 0;
    if (homeExpectedGoals !== null && homePenalty > 0) {
      homeExpectedGoals = homeExpectedGoals * (1 - homePenalty);
    }
    if (awayExpectedGoals !== null && awayPenalty > 0) {
      awayExpectedGoals = awayExpectedGoals * (1 - awayPenalty);
    }

    const xGAvailable = homeExpectedGoals !== null && awayExpectedGoals !== null;

    const scoreMatrix = xGAvailable ? generateScoreMatrix(homeExpectedGoals, awayExpectedGoals) : [];
    const mostLikelyScores = scoreMatrix.slice(0, 5);

    return {
      probabilities,
      probabilitiesReliable,
      recommendation: {
        winner: recommendedWinner,
        advice,
        confidence: probabilitiesReliable
          ? this._calcRecommendationConfidence(homeWinProb, drawProb, awayWinProb)
          : null,
      },
      form: { home: homeForm, away: awayForm },
      goalsComparison,
      expectedGoals: xGAvailable
        ? {
            home: parseFloat(homeExpectedGoals.toFixed(2)),
            away: parseFloat(awayExpectedGoals.toFixed(2)),
            total: parseFloat((homeExpectedGoals + awayExpectedGoals).toFixed(2)),
            source: 'season',
            venueAdjusted:
              homeSeason.avgForHome != null
              && awaySeason.avgForAway != null
              && homeSeason.avgAgainstHome != null
              && awaySeason.avgAgainstAway != null,
            sampleSize: { home: homeSeason.played, away: awaySeason.played },
            lineupAdjustments: {
              home: lineupContext?.home || null,
              away: lineupContext?.away || null,
            },
          }
        : null,
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

  _analyzePlayerMarket(market) {
    return Object.entries(market)
      .map(([player, data]) => ({
        player,
        odd: data.avg,
        prob: parseFloat(oddsToImpliedProb(data.avg).toFixed(1)),
      }))
      .sort((a, b) => b.prob - a.prob)
      .slice(0, 12);
  }

  _findBestBet(analysis) {
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
      if (over?.fairProb && under?.fairProb) {
        const best = over.fairProb > under.fairProb ? over : under;
        const label = best === over ? 'Over 2.5' : 'Under 2.5';
        candidates.push({ market: 'O/U 2.5', selection: label, prob: best.fairProb, odd: best.odd, confidence: getConfidenceLevel(best.fairProb) });
      }
    }

    if (analysis.btts) {
      const { fairProbs, odds } = analysis.btts;
      const best = fairProbs.yes > fairProbs.no ? 'yes' : 'no';
      candidates.push({ market: 'BTTS', selection: best === 'yes' ? 'Oui' : 'Non', prob: fairProbs[best], odd: odds[best], confidence: getConfidenceLevel(fairProbs[best]) });
    }

    // Pure highest probability — user chooses what to bet on, we show the facts
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

  /**
   * Compute expected goals from full-season averages, venue-adjusted.
   * - venue='home': team plays at home, use team.avgFor.home and opponent.avgAgainst.away
   * - venue='away': team plays away, use team.avgFor.away and opponent.avgAgainst.home
   * Falls back to total averages when home/away splits are unavailable.
   * Returns null when season data is unavailable — caller must omit Poisson model.
   */
  _calcExpectedGoals(teamSeason, opponentSeason, venue) {
    if (!teamSeason || !opponentSeason) return null;

    const teamFor = venue === 'home'
      ? (teamSeason.avgForHome ?? teamSeason.avgFor)
      : (teamSeason.avgForAway ?? teamSeason.avgFor);
    const oppAgainst = venue === 'home'
      ? (opponentSeason.avgAgainstAway ?? opponentSeason.avgAgainst)
      : (opponentSeason.avgAgainstHome ?? opponentSeason.avgAgainst);

    if (!Number.isFinite(teamFor) || !Number.isFinite(oppAgainst)) return null;

    // League-average baseline (~1.4 goals/team/match in top European leagues)
    const baseline = 1.4;
    const attackStrength = teamFor / baseline;
    const defenseWeakness = oppAgainst / baseline;
    return Math.max(0.3, attackStrength * defenseWeakness * baseline);
  }

  _parsePercent(value) {
    if (value === null || value === undefined) return null;
    const str = String(value).replace('%', '').trim();
    if (str === '') return null;
    const n = parseFloat(str);
    return Number.isFinite(n) ? n : null;
  }

  /**
   * Extract season goals averages from /teams/statistics response.
   * Returns full {avgFor*, avgAgainst*, played} venue-split breakdown.
   * Returns null if total averages are unusable.
   * Skips early-season tiny samples (<5 played) to avoid noise worse than last_5.
   */
  _extractSeasonGoals(stats) {
    if (!stats || typeof stats !== 'object') return null;

    const avgFor = parseFloat(stats?.goals?.for?.average?.total);
    const avgAgainst = parseFloat(stats?.goals?.against?.average?.total);
    const played = parseInt(stats?.fixtures?.played?.total, 10);

    if (!Number.isFinite(avgFor) || !Number.isFinite(avgAgainst)) return null;
    if (Number.isFinite(played) && played < 5) return null;

    // Venue-split averages (used for venue-adjusted xG, with total as fallback)
    const avgForHome = parseFloat(stats?.goals?.for?.average?.home);
    const avgForAway = parseFloat(stats?.goals?.for?.average?.away);
    const avgAgainstHome = parseFloat(stats?.goals?.against?.average?.home);
    const avgAgainstAway = parseFloat(stats?.goals?.against?.average?.away);

    return {
      avgFor,
      avgAgainst,
      avgForHome: Number.isFinite(avgForHome) ? avgForHome : null,
      avgForAway: Number.isFinite(avgForAway) ? avgForAway : null,
      avgAgainstHome: Number.isFinite(avgAgainstHome) ? avgAgainstHome : null,
      avgAgainstAway: Number.isFinite(avgAgainstAway) ? avgAgainstAway : null,
      played: Number.isFinite(played) ? played : null,
    };
  }

  _calcRecommendationConfidence(home, draw, away) {
    const max = Math.max(home, draw, away);
    const second = [home, draw, away].sort((a, b) => b - a)[1];
    const gap = max - second;
    return parseFloat(Math.min(95, max + gap * 0.5).toFixed(1));
  }
}

module.exports = new AnalysisService();
