/**
 * Gomoku AI: Easy (random), Medium (heuristic), Hard (minimax + alpha-beta).
 * Depends on GomokuGame (loaded first in the browser, or required in Node).
 */
(function (root, factory) {
  "use strict";
  const Game =
    typeof module !== "undefined" && module.exports
      ? require("./game.js")
      : root.GomokuGame;

  const api = factory(Game);
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.GomokuAI = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Game) {
  "use strict";

  const WIN_SCORE = 1000000;
  const LOSE_SCORE = -1000000;

  /**
   * Pattern scores for a consecutive run with `openEnds` free ends (0–2).
   * Tuned for freestyle Gomoku attack / defence.
   */
  function patternScore(length, openEnds) {
    if (length >= 5) {
      return WIN_SCORE;
    }
    if (openEnds === 0) {
      return 0;
    }

    const table = {
      4: { 1: 10000, 2: 50000 },
      3: { 1: 500, 2: 5000 },
      2: { 1: 50, 2: 400 },
      1: { 1: 5, 2: 20 },
    };

    const byEnds = table[length];
    return byEnds ? byEnds[openEnds] || 0 : 0;
  }

  /**
   * Score one direction through `index` for `player`.
   * Counts contiguous stones of player and how many ends are empty.
   */
  function scoreDirection(board, index, player, dr, dc) {
    const { row, col } = Game.indexToCoord(index);
    let length = 1;
    let openEnds = 0;

    // Forward
    let r = row + dr;
    let c = col + dc;
    while (Game.inBounds(r, c) && board[Game.coordToIndex(r, c)] === player) {
      length += 1;
      r += dr;
      c += dc;
    }
    if (Game.inBounds(r, c) && board[Game.coordToIndex(r, c)] === Game.EMPTY) {
      openEnds += 1;
    }

    // Backward
    r = row - dr;
    c = col - dc;
    while (Game.inBounds(r, c) && board[Game.coordToIndex(r, c)] === player) {
      length += 1;
      r -= dr;
      c -= dc;
    }
    if (Game.inBounds(r, c) && board[Game.coordToIndex(r, c)] === Game.EMPTY) {
      openEnds += 1;
    }

    return patternScore(length, openEnds);
  }

  /**
   * Immediate value of placing `player` at `index` (attack strength only).
   */
  function scoreMoveForPlayer(board, index, player) {
    let total = 0;
    for (let i = 0; i < Game.DIRECTIONS.length; i += 1) {
      const dr = Game.DIRECTIONS[i][0];
      const dc = Game.DIRECTIONS[i][1];
      total += scoreDirection(board, index, player, dr, dc);
    }
    return total;
  }

  /**
   * Heuristic evaluation of the whole board for `perspective` player.
   * Positive means advantageous for perspective.
   */
  function evaluateBoard(board, perspective) {
    let score = 0;
    const opponent = Game.nextPlayer(perspective);

    for (let i = 0; i < Game.CELL_COUNT; i += 1) {
      if (board[i] === perspective) {
        // Avoid double-counting: only evaluate each stone as a temporary
        // "focus" using half weight would under-count; instead sum pattern
        // scores from each stone and divide by roughly 2 via direction
        // uniqueness. We use a lighter aggregate: score each occupied
        // cell once using the four directions (patterns overlap, which
        // still ranks boards usefully for shallow search).
        score += scoreMoveForPlayer(board, i, perspective) * 0.35;
      } else if (board[i] === opponent) {
        score -= scoreMoveForPlayer(board, i, opponent) * 0.35;
      }
    }

    return score;
  }

  /**
   * Rank candidates: attack for me + defence against opponent.
   */
  function rankMove(board, index, player) {
    const opponent = Game.nextPlayer(player);
    board[index] = player;
    const attack = scoreMoveForPlayer(board, index, player);
    board[index] = opponent;
    const defence = scoreMoveForPlayer(board, index, opponent);
    board[index] = Game.EMPTY;
    // Prefer winning / blocking wins immediately.
    return attack * 1.1 + defence;
  }

  function sortCandidates(board, candidates, player) {
    const scored = candidates.map(function (index) {
      return { index: index, score: rankMove(board, index, player) };
    });
    scored.sort(function (a, b) {
      return b.score - a.score;
    });
    return scored;
  }

  function pickRandom(moves) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  /** Easy: random legal move among candidates (or any empty if empty board). */
  function getEasyMove(board) {
    const candidates = Game.getCandidateMoves(board, 2);
    const pool = candidates.length > 0 ? candidates : Game.getLegalMoves(board);
    if (pool.length === 0) {
      return null;
    }
    return pickRandom(pool);
  }

  /** Medium: greedy heuristic attack + defence on candidate set. */
  function getMediumMove(board, player) {
    const candidates = Game.getCandidateMoves(board, 2);
    if (candidates.length === 0) {
      return null;
    }

    const ranked = sortCandidates(board, candidates, player);
    const bestScore = ranked[0].score;
    const top = ranked.filter(function (item) {
      return item.score === bestScore;
    });
    return pickRandom(top).index;
  }

  /**
   * Depth-limited minimax with alpha-beta pruning.
   * `maximizing` is true when current search player === aiPlayer.
   */
  function minimax(board, depth, alpha, beta, aiPlayer, currentPlayer, stats) {
    stats.nodes += 1;

    // Terminal via last move is checked by caller; here we only evaluate
    // leaves by depth. Full wins are handled when a move is applied.
    if (depth === 0) {
      return { score: evaluateBoard(board, aiPlayer), move: null };
    }

    let candidates = Game.getCandidateMoves(board, 2);
    if (candidates.length === 0) {
      return { score: evaluateBoard(board, aiPlayer), move: null };
    }

    // Narrow branching: keep top-N by static rank.
    const maxBranch = depth >= 2 ? 12 : 18;
    const ranked = sortCandidates(board, candidates, currentPlayer);
    candidates = ranked.slice(0, maxBranch).map(function (item) {
      return item.index;
    });

    const maximizing = currentPlayer === aiPlayer;
    let bestMove = candidates[0];

    if (maximizing) {
      let bestScore = -Infinity;
      for (let i = 0; i < candidates.length; i += 1) {
        const move = candidates[i];
        board[move] = currentPlayer;
        const win = Game.checkWinnerFrom(board, move);
        let score;
        if (win) {
          score = WIN_SCORE - (10 - depth);
        } else if (Game.isDraw(board)) {
          score = 0;
        } else {
          score = minimax(
            board,
            depth - 1,
            alpha,
            beta,
            aiPlayer,
            Game.nextPlayer(currentPlayer),
            stats
          ).score;
        }
        board[move] = Game.EMPTY;

        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
        if (bestScore > alpha) {
          alpha = bestScore;
        }
        if (beta <= alpha) {
          break;
        }
      }
      return { score: bestScore, move: bestMove };
    }

    let bestScore = Infinity;
    for (let i = 0; i < candidates.length; i += 1) {
      const move = candidates[i];
      board[move] = currentPlayer;
      const win = Game.checkWinnerFrom(board, move);
      let score;
      if (win) {
        score = LOSE_SCORE + (10 - depth);
      } else if (Game.isDraw(board)) {
        score = 0;
      } else {
        score = minimax(
          board,
          depth - 1,
          alpha,
          beta,
          aiPlayer,
          Game.nextPlayer(currentPlayer),
          stats
        ).score;
      }
      board[move] = Game.EMPTY;

      if (score < bestScore) {
        bestScore = score;
        bestMove = move;
      }
      if (bestScore < beta) {
        beta = bestScore;
      }
      if (beta <= alpha) {
        break;
      }
    }
    return { score: bestScore, move: bestMove };
  }

  /**
   * Hard: shallow iterative deepening (depth 1 then 2) with alpha-beta.
   * Returns a Promise so the UI can paint "thinking" before the search runs.
   */
  function getHardMove(board, player, options) {
    const opts = options || {};
    const maxDepth = typeof opts.maxDepth === "number" ? opts.maxDepth : 2;
    const delayMs = typeof opts.yieldMs === "number" ? opts.yieldMs : 20;

    return new Promise(function (resolve) {
      setTimeout(function () {
        const work = Game.cloneBoard(board);
        const stats = { nodes: 0 };
        let best = getMediumMove(work, player);

        for (let depth = 1; depth <= maxDepth; depth += 1) {
          const result = minimax(
            work,
            depth,
            -Infinity,
            Infinity,
            player,
            player,
            stats
          );
          if (result.move !== null && result.move !== undefined) {
            best = result.move;
          }
          // Immediate win found
          if (result.score >= WIN_SCORE / 2) {
            break;
          }
        }

        resolve({ move: best, nodes: stats.nodes });
      }, delayMs);
    });
  }

  /**
   * Unified entry: returns a Promise resolving to a move index (or null).
   */
  function chooseMove(board, player, difficulty) {
    const level = (difficulty || "easy").toLowerCase();

    if (level === "easy") {
      return Promise.resolve(getEasyMove(board));
    }
    if (level === "medium") {
      return Promise.resolve(getMediumMove(board, player));
    }
    if (level === "hard") {
      return getHardMove(board, player).then(function (result) {
        return result.move;
      });
    }

    return Promise.resolve(getEasyMove(board));
  }

  function isLegalAiMove(board, move) {
    return (
      typeof move === "number" &&
      move >= 0 &&
      move < Game.CELL_COUNT &&
      board[move] === Game.EMPTY
    );
  }

  return {
    WIN_SCORE: WIN_SCORE,
    patternScore: patternScore,
    scoreMoveForPlayer: scoreMoveForPlayer,
    evaluateBoard: evaluateBoard,
    rankMove: rankMove,
    getEasyMove: getEasyMove,
    getMediumMove: getMediumMove,
    getHardMove: getHardMove,
    chooseMove: chooseMove,
    isLegalAiMove: isLegalAiMove,
  };
});
