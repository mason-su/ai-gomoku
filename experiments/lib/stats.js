"use strict";

function emptyAiStats(name) {
  return {
    name: name,
    games: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    winsAsBlack: 0,
    winsAsWhite: 0,
    gamesAsBlack: 0,
    gamesAsWhite: 0,
    totalMovesInGames: 0,
    decisionMs: [],
    hardNodes: [],
  };
}

function average(arr) {
  if (!arr.length) {
    return null;
  }
  let sum = 0;
  for (let i = 0; i < arr.length; i += 1) {
    sum += arr[i];
  }
  return sum / arr.length;
}

function createMatchupState(id, a, b, gamesPerColour) {
  return {
    id: id,
    agentA: a,
    agentB: b,
    gamesPerColour: gamesPerColour,
    completed: [],
    nextIndex: 0,
  };
}

/**
 * Build the ordered list of 100 games: 50 A-black/B-white, 50 B-black/A-white.
 */
function buildMatchupSchedule(agentA, agentB, gamesPerColour) {
  const schedule = [];
  for (let i = 0; i < gamesPerColour; i += 1) {
    schedule.push({
      index: schedule.length,
      black: agentA,
      white: agentB,
      colourSplit: "A_black",
    });
  }
  for (let i = 0; i < gamesPerColour; i += 1) {
    schedule.push({
      index: schedule.length,
      black: agentB,
      white: agentA,
      colourSplit: "B_black",
    });
  }
  return schedule;
}

function recordGame(matchup, scheduleEntry, gameResult) {
  const record = {
    index: scheduleEntry.index,
    black: scheduleEntry.black,
    white: scheduleEntry.white,
    colourSplit: scheduleEntry.colourSplit,
    ok: gameResult.ok,
    error: gameResult.error,
    winner: gameResult.winner,
    draw: gameResult.draw,
    moves: gameResult.moves,
    decisionMs: {
      easy: gameResult.perAi.easy.decisionMs.slice(),
      medium: gameResult.perAi.medium.decisionMs.slice(),
      hard: gameResult.perAi.hard.decisionMs.slice(),
    },
    hardNodes: gameResult.perAi.hard.nodes.slice(),
  };
  matchup.completed.push(record);
  matchup.nextIndex = matchup.completed.length;
  return record;
}

function summariseMatchup(matchup) {
  const agents = {};
  agents[matchup.agentA] = emptyAiStats(matchup.agentA);
  agents[matchup.agentB] = emptyAiStats(matchup.agentB);

  let errors = 0;
  let blackWins = 0;
  let whiteWins = 0;
  let draws = 0;

  for (let i = 0; i < matchup.completed.length; i += 1) {
    const g = matchup.completed[i];
    if (!g.ok) {
      errors += 1;
      continue;
    }

    const blackStats = agents[g.black];
    const whiteStats = agents[g.white];
    blackStats.games += 1;
    whiteStats.games += 1;
    blackStats.gamesAsBlack += 1;
    whiteStats.gamesAsWhite += 1;
    blackStats.totalMovesInGames += g.moves;
    whiteStats.totalMovesInGames += g.moves;

    ["easy", "medium", "hard"].forEach(function (level) {
      const ms = g.decisionMs[level] || [];
      if (agents[level]) {
        agents[level].decisionMs.push.apply(agents[level].decisionMs, ms);
      }
    });
    if (agents.hard && g.hardNodes) {
      agents.hard.hardNodes.push.apply(agents.hard.hardNodes, g.hardNodes);
    }

    if (g.draw) {
      draws += 1;
      blackStats.draws += 1;
      whiteStats.draws += 1;
      continue;
    }

    if (g.winner === "B") {
      blackWins += 1;
      blackStats.wins += 1;
      blackStats.winsAsBlack += 1;
      whiteStats.losses += 1;
    } else if (g.winner === "W") {
      whiteWins += 1;
      whiteStats.wins += 1;
      whiteStats.winsAsWhite += 1;
      blackStats.losses += 1;
    }
  }

  function finalise(stats) {
    const played = stats.wins + stats.losses + stats.draws;
    return {
      name: stats.name,
      games: stats.games,
      wins: stats.wins,
      losses: stats.losses,
      draws: stats.draws,
      winRate: played ? stats.wins / played : null,
      winsAsBlack: stats.winsAsBlack,
      winsAsWhite: stats.winsAsWhite,
      gamesAsBlack: stats.gamesAsBlack,
      gamesAsWhite: stats.gamesAsWhite,
      winRateAsBlack: stats.gamesAsBlack
        ? stats.winsAsBlack / stats.gamesAsBlack
        : null,
      winRateAsWhite: stats.gamesAsWhite
        ? stats.winsAsWhite / stats.gamesAsWhite
        : null,
      avgMovesPerGame: stats.games ? stats.totalMovesInGames / stats.games : null,
      avgDecisionMs: average(stats.decisionMs),
      avgHardNodes: average(stats.hardNodes),
      decisionsCounted: stats.decisionMs.length,
    };
  }

  return {
    id: matchup.id,
    agentA: matchup.agentA,
    agentB: matchup.agentB,
    gamesCompleted: matchup.completed.length,
    errors: errors,
    blackWins: blackWins,
    whiteWins: whiteWins,
    draws: draws,
    firstPlayerWinRate:
      blackWins + whiteWins + draws > 0
        ? blackWins / (blackWins + whiteWins + draws)
        : null,
    agents: {
      [matchup.agentA]: finalise(agents[matchup.agentA]),
      [matchup.agentB]: finalise(agents[matchup.agentB]),
    },
  };
}

module.exports = {
  emptyAiStats: emptyAiStats,
  average: average,
  createMatchupState: createMatchupState,
  buildMatchupSchedule: buildMatchupSchedule,
  recordGame: recordGame,
  summariseMatchup: summariseMatchup,
};
