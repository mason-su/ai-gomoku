"use strict";

const path = require("path");
const { createRng } = require("./lib/seed.js");
const { playGame, Game, AI } = require("./lib/simulate.js");
const {
  buildMatchupSchedule,
  createMatchupState,
  recordGame,
  summariseMatchup,
} = require("./lib/stats.js");

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    console.log("PASS:", msg);
  } else {
    failed += 1;
    console.error("FAIL:", msg);
  }
}

// Seeded RNG is deterministic
(function () {
  const a = createRng(123);
  const b = createRng(123);
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  assert(
    seqA[0] === seqB[0] && seqA[1] === seqB[1] && seqA[2] === seqB[2],
    "same seed yields same RNG sequence"
  );
  assert(createRng(1)() !== createRng(2)(), "different seeds diverge");
})();

// Schedule colour balance
(function () {
  const schedule = buildMatchupSchedule("easy", "medium", 50);
  assert(schedule.length === 100, "100 games scheduled for 50 per colour");
  const aBlack = schedule.filter(function (g) {
    return g.black === "easy" && g.white === "medium";
  }).length;
  const bBlack = schedule.filter(function (g) {
    return g.black === "medium" && g.white === "easy";
  }).length;
  assert(aBlack === 50 && bBlack === 50, "50/50 colour swap in schedule");
})();

// Headless game produces legal terminal state
(function () {
  const rng = createRng(7);
  const result = playGame("easy", "easy", rng, { hardMaxDepth: 1 });
  assert(result.ok === true, "easy vs easy simulation ok");
  assert(
    (result.draw === true && result.winner === null) ||
      result.winner === Game.BLACK ||
      result.winner === Game.WHITE,
    "simulation ends in win or draw"
  );
  assert(result.moves > 0 && result.moves <= Game.CELL_COUNT, "move count in range");
})();

// Stats aggregation counts wins by colour
(function () {
  const matchup = createMatchupState("test", "easy", "medium", 2);
  const schedule = buildMatchupSchedule("easy", "medium", 2);
  // Fake two decisive games: easy wins as black, medium wins as black
  recordGame(matchup, schedule[0], {
    ok: true,
    error: null,
    winner: "B",
    draw: false,
    moves: 20,
    blackDiff: "easy",
    whiteDiff: "medium",
    perAi: {
      easy: { decisionMs: [1, 2], nodes: [] },
      medium: { decisionMs: [3], nodes: [] },
      hard: { decisionMs: [], nodes: [] },
    },
  });
  recordGame(matchup, schedule[2], {
    ok: true,
    error: null,
    winner: "B",
    draw: false,
    moves: 22,
    blackDiff: "medium",
    whiteDiff: "easy",
    perAi: {
      easy: { decisionMs: [1], nodes: [] },
      medium: { decisionMs: [2, 2], nodes: [] },
      hard: { decisionMs: [], nodes: [] },
    },
  });
  const summary = summariseMatchup(matchup);
  assert(summary.agents.easy.wins === 1, "easy wins counted");
  assert(summary.agents.medium.wins === 1, "medium wins counted");
  assert(summary.agents.easy.winsAsBlack === 1, "easy black win tracked");
  assert(summary.agents.medium.winsAsBlack === 1, "medium black win tracked");
  assert(summary.blackWins === 2, "first-player wins aggregated");
})();

// chooseMoveSync hard returns nodes
(function () {
  const board = Game.createBoard();
  board[Game.coordToIndex(7, 7)] = Game.BLACK;
  const hard = AI.chooseMoveSync(board, Game.WHITE, "hard", {
    random: createRng(0),
    maxDepth: 1,
  });
  assert(AI.isLegalAiMove(board, hard.move), "sync hard move is legal");
  assert(typeof hard.nodes === "number" && hard.nodes > 0, "sync hard reports nodes");
})();

console.log("");
console.log("Result:", passed, "passed,", failed, "failed");
process.exit(failed === 0 ? 0 : 1);
