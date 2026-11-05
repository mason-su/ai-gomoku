/**
 * Gomoku AI: Easy (beginner heuristic + noise), Medium (greedy), Hard (minimax).
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

  function pickRandom(moves, randomFn) {
    const rnd = typeof randomFn === "function" ? randomFn : Math.random;
    return moves[Math.floor(rnd() * moves.length)];
  }

  /**
   * Tunable Easy AI knobs (beginner: sees forced wins/blocks, noisy otherwise).
   * Higher SCORE_WEIGHT_EXPONENT → closer to Medium. Lower → more random.
   */
  const EASY_DEFAULTS = {
    /** Softmax-like emphasis on higher heuristic scores (typically 1.0–2.0). Lower = weaker. */
    SCORE_WEIGHT_EXPONENT: 1.0,
    /** Added before exponentiation so low/negative scores still get some weight. */
    SCORE_WEIGHT_OFFSET: 80,
    /** After ranking, only the top N candidates enter the weighted lottery. Higher = noisier. */
    TOP_CANDIDATE_COUNT: 14,
    /**
     * Chance to skip a non-forced “good” pick and choose uniformly from the top pool.
     * Makes Easy miss quiet attacking/defending chances more often (0–1).
     */
    UNIFORM_PICK_CHANCE: 0.45,
  };

  /**
   * Moves that immediately win for `player` among `candidates`.
   * Temporarily mutates `board` (restored before return).
   */
  function findImmediateWinningMoves(board, player, candidates) {
    const wins = [];
    for (let i = 0; i < candidates.length; i += 1) {
      const index = candidates[i];
      if (board[index] !== Game.EMPTY) {
        continue;
      }
      board[index] = player;
      const win = Game.checkWinnerFrom(board, index);
      board[index] = Game.EMPTY;
      if (win) {
        wins.push(index);
      }
    }
    return wins;
  }

  /**
   * Weighted random among `{ index, score }` items.
   * Weight = (score - minScore + OFFSET) ^ EXPONENT
   */
  function pickWeightedIndex(scoredItems, randomFn, config) {
    if (scoredItems.length === 0) {
      return null;
    }
    if (scoredItems.length === 1) {
      return scoredItems[0].index;
    }

    const offset =
      typeof config.SCORE_WEIGHT_OFFSET === "number"
        ? config.SCORE_WEIGHT_OFFSET
        : EASY_DEFAULTS.SCORE_WEIGHT_OFFSET;
    const exponent =
      typeof config.SCORE_WEIGHT_EXPONENT === "number"
        ? config.SCORE_WEIGHT_EXPONENT
        : EASY_DEFAULTS.SCORE_WEIGHT_EXPONENT;

    let minScore = scoredItems[0].score;
    for (let i = 1; i < scoredItems.length; i += 1) {
      if (scoredItems[i].score < minScore) {
        minScore = scoredItems[i].score;
      }
    }

    const weights = [];
    let total = 0;
    for (let i = 0; i < scoredItems.length; i += 1) {
      const base = scoredItems[i].score - minScore + offset;
      const weight = Math.pow(Math.max(base, 1e-6), exponent);
      weights.push(weight);
      total += weight;
    }

    let needle = randomFn() * total;
    for (let i = 0; i < scoredItems.length; i += 1) {
      needle -= weights[i];
      if (needle <= 0) {
        return scoredItems[i].index;
      }
    }
    return scoredItems[scoredItems.length - 1].index;
  }

  /**
   * Easy: beginner AI — forced win/block, otherwise noisy heuristic choice.
   * options: EASY_DEFAULTS keys + { random }
   */
  function getEasyMove(board, player, options) {
    const opts = options || {};
    const config = {
      SCORE_WEIGHT_EXPONENT:
        typeof opts.SCORE_WEIGHT_EXPONENT === "number"
          ? opts.SCORE_WEIGHT_EXPONENT
          : EASY_DEFAULTS.SCORE_WEIGHT_EXPONENT,
      SCORE_WEIGHT_OFFSET:
        typeof opts.SCORE_WEIGHT_OFFSET === "number"
          ? opts.SCORE_WEIGHT_OFFSET
          : EASY_DEFAULTS.SCORE_WEIGHT_OFFSET,
      TOP_CANDIDATE_COUNT:
        typeof opts.TOP_CANDIDATE_COUNT === "number"
          ? opts.TOP_CANDIDATE_COUNT
          : EASY_DEFAULTS.TOP_CANDIDATE_COUNT,
      UNIFORM_PICK_CHANCE:
        typeof opts.UNIFORM_PICK_CHANCE === "number"
          ? opts.UNIFORM_PICK_CHANCE
          : EASY_DEFAULTS.UNIFORM_PICK_CHANCE,
    };
    const randomFn = typeof opts.random === "function" ? opts.random : Math.random;

    let candidates = Game.getCandidateMoves(board, 2);
    if (candidates.length === 0) {
      candidates = Game.getLegalMoves(board);
    }
    if (candidates.length === 0) {
      return null;
    }

    // 1) Always finish an immediate win.
    const myWins = findImmediateWinningMoves(board, player, candidates);
    if (myWins.length > 0) {
      return pickRandom(myWins, randomFn);
    }

    // 2) Always block an opponent's immediate win.
    const opponent = Game.nextPlayer(player);
    const blocks = findImmediateWinningMoves(board, opponent, candidates);
    if (blocks.length > 0) {
      return pickRandom(blocks, randomFn);
    }

    // 3) Otherwise: rank by the shared heuristic, keep top-N, then sample.
    const ranked = sortCandidates(board, candidates, player);
    const topCount = Math.max(
      1,
      Math.min(config.TOP_CANDIDATE_COUNT, ranked.length)
    );
    const pool = ranked.slice(0, topCount);

    // Often ignore weights and pick uniformly → more beginner-like mistakes.
    if (randomFn() < config.UNIFORM_PICK_CHANCE) {
      return pickRandom(
        pool.map(function (item) {
          return item.index;
        }),
        randomFn
      );
    }

    return pickWeightedIndex(pool, randomFn, config);
  }

  /** Medium: greedy heuristic attack + defence on candidate set. */
  function getMediumMove(board, player, options) {
    const opts = options || {};
    const randomFn = typeof opts.random === "function" ? opts.random : Math.random;
    const candidates = Game.getCandidateMoves(board, 2);
    if (candidates.length === 0) {
      return null;
    }

    const ranked = sortCandidates(board, candidates, player);
    const bestScore = ranked[0].score;
    const top = ranked.filter(function (item) {
      return item.score === bestScore;
    });
    return pickRandom(top, randomFn).index;
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
   * Synchronous Hard search (shared by browser Promise wrapper and Node benchmarks).
   * options: { maxDepth, random }
   */
  function searchHardMove(board, player, options) {
    const opts = options || {};
    const maxDepth = typeof opts.maxDepth === "number" ? opts.maxDepth : 2;
    const work = Game.cloneBoard(board);
    const stats = { nodes: 0 };
    let best = getMediumMove(work, player, opts);

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
      if (result.score >= WIN_SCORE / 2) {
        break;
      }
    }

    return { move: best, nodes: stats.nodes };
  }

  /**
   * Hard: shallow iterative deepening (depth 1 then 2) with alpha-beta.
   * Returns a Promise so the UI can paint "thinking" before the search runs.
   */
  function getHardMove(board, player, options) {
    const opts = options || {};
    const delayMs = typeof opts.yieldMs === "number" ? opts.yieldMs : 20;

    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve(searchHardMove(board, player, opts));
      }, delayMs);
    });
  }

  /**
   * Unified entry: returns a Promise resolving to a move index (or null).
   * options forwarded to Easy / Medium / Hard (e.g. { random, maxDepth, yieldMs }).
   */
  function chooseMove(board, player, difficulty, options) {
    const level = (difficulty || "easy").toLowerCase();
    const opts = options || {};

    if (level === "easy") {
      return Promise.resolve(getEasyMove(board, player, opts));
    }
    if (level === "medium") {
      return Promise.resolve(getMediumMove(board, player, opts));
    }
    if (level === "hard") {
      return getHardMove(board, player, opts).then(function (result) {
        return result.move;
      });
    }

    return Promise.resolve(getEasyMove(board, player, opts));
  }

  /**
   * Synchronous chooser for headless benchmarks. Returns { move, nodes, difficulty }.
   */
  function chooseMoveSync(board, player, difficulty, options) {
    const level = (difficulty || "easy").toLowerCase();
    const opts = options || {};

    if (level === "hard") {
      const hard = searchHardMove(board, player, opts);
      return { move: hard.move, nodes: hard.nodes, difficulty: level };
    }
    if (level === "medium") {
      return {
        move: getMediumMove(board, player, opts),
        nodes: null,
        difficulty: level,
      };
    }
    return {
      move: getEasyMove(board, player, opts),
      nodes: null,
      difficulty: "easy",
    };
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
    EASY_DEFAULTS: EASY_DEFAULTS,
    patternScore: patternScore,
    scoreMoveForPlayer: scoreMoveForPlayer,
    evaluateBoard: evaluateBoard,
    rankMove: rankMove,
    findImmediateWinningMoves: findImmediateWinningMoves,
    pickWeightedIndex: pickWeightedIndex,
    getEasyMove: getEasyMove,
    getMediumMove: getMediumMove,
    searchHardMove: searchHardMove,
    getHardMove: getHardMove,
    chooseMove: chooseMove,
    chooseMoveSync: chooseMoveSync,
    isLegalAiMove: isLegalAiMove,
  };
});
