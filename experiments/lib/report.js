"use strict";

const fs = require("fs");
const path = require("path");

function pct(x) {
  if (x === null || x === undefined || Number.isNaN(x)) {
    return "—";
  }
  return (100 * x).toFixed(1) + "%";
}

function num(x, digits) {
  if (x === null || x === undefined || Number.isNaN(x)) {
    return "—";
  }
  return Number(x).toFixed(digits === undefined ? 2 : digits);
}

function bar(rate, width) {
  const w = width || 20;
  if (rate === null || rate === undefined) {
    return "".padEnd(w, "·");
  }
  const filled = Math.round(Math.max(0, Math.min(1, rate)) * w);
  return "#".repeat(filled) + "·".repeat(w - filled);
}

function matchupTable(summary) {
  const a = summary.agents[summary.agentA];
  const b = summary.agents[summary.agentB];
  const lines = [];
  lines.push("| Metric | " + a.name + " | " + b.name + " |");
  lines.push("|--------|" + "-".repeat(a.name.length + 2) + "|" + "-".repeat(b.name.length + 2) + "|");
  lines.push("| Games | " + a.games + " | " + b.games + " |");
  lines.push("| Wins | " + a.wins + " | " + b.wins + " |");
  lines.push("| Losses | " + a.losses + " | " + b.losses + " |");
  lines.push("| Draws | " + a.draws + " | " + b.draws + " |");
  lines.push("| Win rate | " + pct(a.winRate) + " | " + pct(b.winRate) + " |");
  lines.push("| Win rate as Black | " + pct(a.winRateAsBlack) + " | " + pct(b.winRateAsBlack) + " |");
  lines.push("| Win rate as White | " + pct(a.winRateAsWhite) + " | " + pct(b.winRateAsWhite) + " |");
  lines.push("| Avg moves / game | " + num(a.avgMovesPerGame, 1) + " | " + num(b.avgMovesPerGame, 1) + " |");
  lines.push("| Avg decision ms | " + num(a.avgDecisionMs, 2) + " | " + num(b.avgDecisionMs, 2) + " |");
  lines.push("| Avg Hard nodes | " + num(a.avgHardNodes, 1) + " | " + num(b.avgHardNodes, 1) + " |");
  return lines.join("\n");
}

function buildMarkdown(experiment) {
  const lines = [];
  lines.push("# Gomoku AI Benchmark Report");
  lines.push("");
  lines.push("Generated: `" + experiment.finishedAt + "`");
  lines.push("");
  lines.push("## Setup");
  lines.push("");
  lines.push("- Rules: freestyle Gomoku (five-or-more), same `js/game.js` as the web app");
  lines.push("- Agents: Easy / Medium / Hard from `js/ai.js` (no separate implementations)");
  lines.push("- Matchups: Easy vs Medium, Easy vs Hard, Medium vs Hard");
  lines.push("- Games per matchup: **" + experiment.gamesPerMatchup + "** (" + experiment.gamesPerColour + " per colour assignment)");
  lines.push("- Seed: `" + String(experiment.seed) + "`");
  lines.push("- Hard max depth: `" + experiment.hardMaxDepth + "`");
  lines.push("");
  lines.push("> **Interpretation note:** These are *observed* win rates under this engine and this sample size.");
  lines.push("> They are **not** proofs of theoretical playing strength. Randomness (Easy noise, Medium ties)");
  lines.push("> and shallow Hard search mean rankings can shift with seed and sample size.");
  lines.push("");
  lines.push("## First-player (Black) advantage");
  lines.push("");
  lines.push("| Matchup | Black wins | White wins | Draws | Black win rate |");
  lines.push("|---------|------------|------------|-------|----------------|");
  experiment.summaries.forEach(function (s) {
    const total = s.blackWins + s.whiteWins + s.draws;
    lines.push(
      "| " +
        s.agentA +
        " vs " +
        s.agentB +
        " | " +
        s.blackWins +
        " | " +
        s.whiteWins +
        " | " +
        s.draws +
        " | " +
        pct(total ? s.blackWins / total : null) +
        " |"
    );
  });
  lines.push("");

  experiment.summaries.forEach(function (s) {
    lines.push("## Matchup: " + s.agentA + " vs " + s.agentB);
    lines.push("");
    lines.push(matchupTable(s));
    lines.push("");
    const a = s.agents[s.agentA];
    const b = s.agents[s.agentB];
    lines.push("Win-rate bars (overall):");
    lines.push("");
    lines.push("```");
    lines.push(a.name.padEnd(8) + " " + bar(a.winRate) + " " + pct(a.winRate));
    lines.push(b.name.padEnd(8) + " " + bar(b.winRate) + " " + pct(b.winRate));
    lines.push("```");
    lines.push("");
    if (s.errors) {
      lines.push("_Errors in this matchup: " + s.errors + "_");
      lines.push("");
    }
  });

  lines.push("## Analysis");
  lines.push("");
  lines.push("1. **Colour balance:** Each pair swaps colours evenly, so overall win rate is less biased by first-move advantage than a fixed-colour series.");
  lines.push("2. **Compare Black-win columns across matchups** to see whether the opening seat still matters even after swaps.");
  lines.push("3. **Decision time / Hard nodes** measure computational cost, not strength by themselves.");
  lines.push("4. Prefer larger samples before drawing strong conclusions; use `--seed` to reproduce a run.");
  lines.push("");
  lines.push("## Files");
  lines.push("");
  lines.push("- JSON: `" + path.basename(experiment.jsonPath) + "`");
  lines.push("- CSV: `" + path.basename(experiment.csvPath) + "`");
  lines.push("- Checkpoint: `" + path.basename(experiment.checkpointPath) + "`");
  lines.push("");
  return lines.join("\n");
}

function toCsv(experiment) {
  const header = [
    "matchup",
    "game_index",
    "black",
    "white",
    "colour_split",
    "ok",
    "winner",
    "draw",
    "moves",
    "error",
  ];
  const rows = [header.join(",")];
  experiment.matchups.forEach(function (m) {
    m.completed.forEach(function (g) {
      rows.push(
        [
          m.id,
          g.index,
          g.black,
          g.white,
          g.colourSplit,
          g.ok,
          g.winner === null ? "" : g.winner,
          g.draw,
          g.moves,
          g.error ? JSON.stringify(g.error) : "",
        ].join(",")
      );
    });
  });
  return rows.join("\n") + "\n";
}

function writeOutputs(experiment, resultsDir) {
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  fs.writeFileSync(experiment.jsonPath, JSON.stringify(experiment, null, 2), "utf8");
  fs.writeFileSync(experiment.csvPath, toCsv(experiment), "utf8");
  fs.writeFileSync(experiment.reportPath, buildMarkdown(experiment), "utf8");
}

module.exports = {
  buildMarkdown: buildMarkdown,
  toCsv: toCsv,
  writeOutputs: writeOutputs,
  pct: pct,
  bar: bar,
};
