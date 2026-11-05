"use strict";

const path = require("path");
const Game = require(path.join(__dirname, "..", "..", "js", "game.js"));
const AI = require(path.join(__dirname, "..", "..", "js", "ai.js"));

const MAX_MOVES = Game.CELL_COUNT + 2;

/**
 * Play one headless game between two difficulties.
 * blackDiff / whiteDiff: "easy" | "medium" | "hard"
 * rng: function () => [0,1)
 *
 * Returns a result object (never throws for normal illegal-move fallbacks).
 */
function playGame(blackDiff, whiteDiff, rng, options) {
  const opts = options || {};
  const maxDepth = typeof opts.hardMaxDepth === "number" ? opts.hardMaxDepth : 2;
  const board = Game.createBoard();
  let current = Game.BLACK;
  let moves = 0;
  const perAi = {
    easy: { decisionMs: [], nodes: [] },
    medium: { decisionMs: [], nodes: [] },
    hard: { decisionMs: [], nodes: [] },
  };

  const aiOpts = { random: rng, maxDepth: maxDepth };

  while (moves < MAX_MOVES) {
    const difficulty = current === Game.BLACK ? blackDiff : whiteDiff;
    const started = process.hrtime.bigint();
    let choice;
    try {
      choice = AI.chooseMoveSync(board, current, difficulty, aiOpts);
    } catch (err) {
      return {
        ok: false,
        error: "AI threw: " + (err && err.message ? err.message : String(err)),
        winner: null,
        draw: false,
        moves: moves,
        blackDiff: blackDiff,
        whiteDiff: whiteDiff,
        perAi: perAi,
      };
    }
    const ended = process.hrtime.bigint();
    const ms = Number(ended - started) / 1e6;

    let move = choice.move;
    if (!AI.isLegalAiMove(board, move)) {
      move = AI.getEasyMove(board, current, { random: rng });
    }
    if (!AI.isLegalAiMove(board, move)) {
      return {
        ok: false,
        error: "No legal move for " + difficulty + " as " + current,
        winner: null,
        draw: false,
        moves: moves,
        blackDiff: blackDiff,
        whiteDiff: whiteDiff,
        perAi: perAi,
      };
    }

    const bucket = perAi[difficulty] || perAi.easy;
    bucket.decisionMs.push(ms);
    if (typeof choice.nodes === "number") {
      bucket.nodes.push(choice.nodes);
    }

    board[move] = current;
    moves += 1;

    const win = Game.checkWinnerFrom(board, move);
    if (win) {
      return {
        ok: true,
        error: null,
        winner: win.winner,
        draw: false,
        moves: moves,
        blackDiff: blackDiff,
        whiteDiff: whiteDiff,
        perAi: perAi,
      };
    }

    if (Game.isDraw(board)) {
      return {
        ok: true,
        error: null,
        winner: null,
        draw: true,
        moves: moves,
        blackDiff: blackDiff,
        whiteDiff: whiteDiff,
        perAi: perAi,
      };
    }

    current = Game.nextPlayer(current);
  }

  return {
    ok: false,
    error: "Exceeded max moves (possible infinite loop)",
    winner: null,
    draw: false,
    moves: moves,
    blackDiff: blackDiff,
    whiteDiff: whiteDiff,
    perAi: perAi,
  };
}

module.exports = {
  playGame: playGame,
  MAX_MOVES: MAX_MOVES,
  Game: Game,
  AI: AI,
};
