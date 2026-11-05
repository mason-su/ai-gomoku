#!/usr/bin/env node
"use strict";

/**
 * Local-only Gomoku AI benchmark (not used by GitHub Pages).
 *
 * Examples:
 *   node experiments/run-benchmark.js --smoke
 *   node experiments/run-benchmark.js --all
 *   node experiments/run-benchmark.js --all --seed 42
 *   node experiments/run-benchmark.js --resume
 */

const fs = require("fs");
const path = require("path");
const { createRng } = require("./lib/seed.js");
const { playGame } = require("./lib/simulate.js");
const {
  createMatchupState,
  buildMatchupSchedule,
  recordGame,
  summariseMatchup,
} = require("./lib/stats.js");
const { writeOutputs } = require("./lib/report.js");

const RESULTS_DIR = path.join(__dirname, "results");
const CHECKPOINT = path.join(RESULTS_DIR, "checkpoint.json");

const FULL_MATCHUPS = [
  { id: "easy_vs_medium", a: "easy", b: "medium" },
  { id: "easy_vs_hard", a: "easy", b: "hard" },
  { id: "medium_vs_hard", a: "medium", b: "hard" },
];

function parseArgs(argv) {
  const args = {
    smoke: false,
    all: false,
    resume: false,
    seed: null,
    gamesPerColour: 50,
    hardMaxDepth: 2,
    help: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--smoke") {
      args.smoke = true;
    } else if (a === "--all") {
      args.all = true;
    } else if (a === "--resume") {
      args.resume = true;
    } else if (a === "--help" || a === "-h") {
      args.help = true;
    } else if (a === "--seed") {
      args.seed = argv[i + 1];
      i += 1;
    } else if (a === "--games-per-colour") {
      args.gamesPerColour = Number(argv[i + 1]);
      i += 1;
    } else if (a === "--hard-depth") {
      args.hardMaxDepth = Number(argv[i + 1]);
      i += 1;
    }
  }
  return args;
}

function printHelp() {
  console.log("Gomoku AI benchmark (local Node.js only)\n");
  console.log("  --smoke                 Run 2 games per colour × 3 matchups (12 games)");
  console.log("  --all                   Run full 50+50 × 3 matchups (300 games)");
  console.log("  --resume                Continue from experiments/results/checkpoint.json");
  console.log("  --seed <n>              Seeded PRNG for reproducibility");
  console.log("  --games-per-colour <n>  Override per-colour count (default 50)");
  console.log("  --hard-depth <n>        Hard AI maxDepth (default 2)");
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function saveCheckpoint(state) {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
  fs.writeFileSync(CHECKPOINT, JSON.stringify(state, null, 2), "utf8");
}

function loadCheckpoint() {
  if (!fs.existsSync(CHECKPOINT)) {
    throw new Error("No checkpoint found at " + CHECKPOINT);
  }
  return JSON.parse(fs.readFileSync(CHECKPOINT, "utf8"));
}

function createFreshState(args) {
  const gamesPerColour = args.smoke ? 2 : args.gamesPerColour;
  const matchups = FULL_MATCHUPS.map(function (m) {
    return createMatchupState(m.id, m.a, m.b, gamesPerColour);
  });

  return {
    version: 1,
    mode: args.smoke ? "smoke" : "full",
    seed: args.seed === null ? null : Number(args.seed),
    hardMaxDepth: args.hardMaxDepth,
    gamesPerColour: gamesPerColour,
    gamesPerMatchup: gamesPerColour * 2,
    createdAt: new Date().toISOString(),
    matchups: matchups,
    activeMatchup: 0,
  };
}

function run() {
  const args = parseArgs(process.argv);
  if (args.help || (!args.smoke && !args.all && !args.resume)) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  let state;
  if (args.resume) {
    state = loadCheckpoint();
    console.log("Resuming checkpoint from", state.createdAt);
  } else {
    state = createFreshState(args);
  }

  const rng = createRng(state.seed);

  for (let mi = state.activeMatchup; mi < state.matchups.length; mi += 1) {
    state.activeMatchup = mi;
    const matchup = state.matchups[mi];
    const schedule = buildMatchupSchedule(
      matchup.agentA,
      matchup.agentB,
      matchup.gamesPerColour
    );

    console.log(
      "\n=== Matchup " +
        matchup.id +
        " (" +
        matchup.completed.length +
        "/" +
        schedule.length +
        ") ==="
    );

    for (let gi = matchup.nextIndex; gi < schedule.length; gi += 1) {
      const entry = schedule[gi];
      const result = playGame(entry.black, entry.white, rng, {
        hardMaxDepth: state.hardMaxDepth,
      });
      recordGame(matchup, entry, result);

      const label = result.ok
        ? result.draw
          ? "draw"
          : "winner=" + result.winner
        : "ERROR " + result.error;
      console.log(
        "  [" +
          (gi + 1) +
          "/" +
          schedule.length +
          "] " +
          entry.black +
          "(B) vs " +
          entry.white +
          "(W) → " +
          label +
          " in " +
          result.moves +
          " moves"
      );

      if ((gi + 1) % 5 === 0 || gi + 1 === schedule.length) {
        saveCheckpoint(state);
      }
    }

    saveCheckpoint(state);
  }

  const summaries = state.matchups.map(summariseMatchup);
  const tag = stamp();
  const experiment = {
    finishedAt: new Date().toISOString(),
    mode: state.mode,
    seed: state.seed,
    hardMaxDepth: state.hardMaxDepth,
    gamesPerColour: state.gamesPerColour,
    gamesPerMatchup: state.gamesPerMatchup,
    matchups: state.matchups,
    summaries: summaries,
    jsonPath: path.join(RESULTS_DIR, "benchmark-" + tag + ".json"),
    csvPath: path.join(RESULTS_DIR, "benchmark-" + tag + ".csv"),
    reportPath: path.join(RESULTS_DIR, "report-" + tag + ".md"),
    checkpointPath: CHECKPOINT,
  };

  writeOutputs(experiment, RESULTS_DIR);
  saveCheckpoint(state);

  console.log("\nDone.");
  console.log("Report:", experiment.reportPath);
  console.log("JSON:  ", experiment.jsonPath);
  console.log("CSV:   ", experiment.csvPath);
}

try {
  run();
} catch (err) {
  console.error("Benchmark failed:", err);
  process.exit(1);
}
