const api = require('./apiFootball');
const { poisson, getConfidenceLevel } = require('../utils/probabilityCalc');
const logger = require('../utils/logger');

class ScorerService {
  /**
   * Main entry: build scorer predictions for a fixture
   */
  async buildScorerPredictions(fixtureId) {
    const [fixtureRes, predRes, lineupsRes] = await Promise.allSettled([
      api.getFixtureById(fixtureId),
      api.getPredictions(fixtureId),
      api.getFixtureLineups(fixtureId),
    ]);

    const fixture = fixtureRes.status === 'fulfilled' ? fixtureRes.value.response?.[0] : null;
    if (!fixture) return null;

    const leagueId = fixture.league?.id;
    const season = fixture.league?.season || 2024;
    const homeTeam = fixture.teams?.home;
    const awayTeam = fixture.teams?.away;

    // xG from predictions
    const prediction = predRes.status === 'fulfilled' ? predRes.value.response?.[0] : null;
    const homeXG = this._extractXG(prediction, 'home') || 1.3;
    const awayXG = this._extractXG(prediction, 'away') || 1.0;

    // Lineups — who is actually playing
    const lineups = lineupsRes.status === 'fulfilled' ? lineupsRes.value.response : [];
    const startingPlayers = this._extractStartingPlayers(lineups, homeTeam?.id, awayTeam?.id);

    // Top scorers for the league
    let topScorers = [];
    try {
      const tsRes = await api.getTopScorers(leagueId, season);
      topScorers = tsRes.response || [];
    } catch (e) {
      logger.warn(`Could not fetch top scorers for league ${leagueId}`);
    }

    // Fixture player stats (live/played matches)
    let fixturePlayers = [];
    try {
      const fpRes = await api.request('/fixtures/players', { fixture: fixtureId }, 60);
      fixturePlayers = fpRes.response || [];
    } catch (e) {
      logger.debug('Fixture players not available');
    }

    const homeScorers = this._buildTeamScorers({
      team: homeTeam,
      xG: homeXG,
      topScorers,
      startingPlayers: startingPlayers[homeTeam?.id] || [],
      fixturePlayers: fixturePlayers.find(t => t.team?.id === homeTeam?.id),
    });

    const awayScorers = this._buildTeamScorers({
      team: awayTeam,
      xG: awayXG,
      topScorers,
      startingPlayers: startingPlayers[awayTeam?.id] || [],
      fixturePlayers: fixturePlayers.find(t => t.team?.id === awayTeam?.id),
    });

    return {
      home: { team: homeTeam, xG: homeXG, scorers: homeScorers },
      away: { team: awayTeam, xG: awayXG, scorers: awayScorers },
      liveStats: fixturePlayers.length > 0,
      season,
    };
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _buildTeamScorers({ team, xG, topScorers, startingPlayers, fixturePlayers }) {
    // P(team scores 0) = Poisson(xG, 0)
    const pTeamScores = 1 - poisson(xG, 0);

    // Pool = top scorers belonging to this team
    const teamTopScorers = topScorers.filter(
      (ts) => ts.statistics?.[0]?.team?.id === team?.id
    );

    const pool = [];

    // From top scorers list
    teamTopScorers.forEach((ts) => {
      const stats = ts.statistics?.[0];
      const goals = stats?.goals?.total || 0;
      const minutes = stats?.games?.minutes || 1;
      const apps = stats?.games?.appearences || 1;
      const goalsPerGame = goals / Math.max(apps, 1);
      const isStarting = startingPlayers.some((p) => p.id === ts.player?.id);

      pool.push({
        id: ts.player?.id,
        name: ts.player?.name,
        photo: ts.player?.photo,
        seasonGoals: goals,
        seasonApps: apps,
        goalsPerGame: parseFloat(goalsPerGame.toFixed(2)),
        isStarting,
        source: 'topscorer',
      });
    });

    // From lineups (players not in top scorers)
    startingPlayers.forEach((sp) => {
      if (!pool.find((p) => p.id === sp.id)) {
        pool.push({
          id: sp.id,
          name: sp.name,
          photo: sp.photo,
          seasonGoals: 0,
          seasonApps: 1,
          goalsPerGame: 0,
          isStarting: true,
          source: 'lineup',
          position: sp.pos,
        });
      }
    });

    if (pool.length === 0) return [];

    // Distribute xG among players proportionally
    const totalGoalRate = pool.reduce((s, p) => s + p.goalsPerGame, 0) || 1;

    // Position-based base rate when no historical data
    const posBaseRate = { G: 0.01, D: 0.05, M: 0.10, F: 0.22 };

    const scored = pool
      .filter((p) => p.source === 'topscorer' || p.isStarting)
      .map((p) => {
        let playerXG;
        if (totalGoalRate > 0 && p.goalsPerGame > 0) {
          playerXG = xG * (p.goalsPerGame / totalGoalRate);
        } else {
          // Fallback: distribute xG by position
          const base = posBaseRate[p.position] ?? 0.08;
          playerXG = xG * base;
        }

        const pScores = playerXG > 0 ? 1 - poisson(playerXG, 0) : 0;
        const adjustedP = p.isStarting ? pScores : pScores * 0.25;
        const liveGoals = this._getLiveGoals(fixturePlayers, p.id);

        return {
          ...p,
          playerXG: parseFloat(playerXG.toFixed(3)),
          probability: parseFloat((adjustedP * 100).toFixed(1)),
          liveGoals,
          confidence: getConfidenceLevel(adjustedP * 100),
        };
      })
      .filter((p) => p.probability > 0.5 || p.liveGoals > 0)
      .sort((a, b) => {
        // Live scorers always first
        if (b.liveGoals !== a.liveGoals) return b.liveGoals - a.liveGoals;
        return b.probability - a.probability;
      })
      .slice(0, 8);

    return scored;
  }

  _extractXG(prediction, side) {
    if (!prediction) return null;
    const teams = prediction.teams;
    const teamKey = side === 'home' ? 'home' : 'away';
    const avgFor = teams?.[teamKey]?.last_5?.goals?.for?.average;
    const avgAgainst = teams?.[side === 'home' ? 'away' : 'home']?.last_5?.goals?.against?.average;
    if (!avgFor || !avgAgainst) return null;
    return parseFloat(((parseFloat(avgFor) + parseFloat(avgAgainst)) / 2).toFixed(2));
  }

  _extractStartingPlayers(lineups, homeId, awayId) {
    const result = {};
    lineups.forEach((lu) => {
      const tid = lu.team?.id;
      if (tid === homeId || tid === awayId) {
        result[tid] = (lu.startXI || []).map((p) => ({
          id: p.player?.id,
          name: p.player?.name,
          photo: p.player?.photo,
          pos: p.player?.pos,
          number: p.player?.number,
        }));
      }
    });
    return result;
  }

  _getLiveGoals(fixturePlayers, playerId) {
    if (!fixturePlayers?.players) return 0;
    const p = fixturePlayers.players.find((fp) => fp.player?.id === playerId);
    return p?.statistics?.[0]?.goals?.total || 0;
  }
}

module.exports = new ScorerService();
