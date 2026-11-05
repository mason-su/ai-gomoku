/**
 * Gomoku (Five in a Row) pure game rules.
 * Freestyle: five or more consecutive stones wins. No forbidden moves.
 *
 * Board is a flat array of length BOARD_SIZE * BOARD_SIZE.
 * Index = row * BOARD_SIZE + col. Empty cells are null.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.GomokuGame = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const BOARD_SIZE = 15;
  const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
  const BLACK = "B";
  const WHITE = "W";
  const EMPTY = null;

  /** Four ray directions: horizontal, vertical, two diagonals. */
  const DIRECTIONS = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  function createBoard() {
    return Array(CELL_COUNT).fill(EMPTY);
  }

  function cloneBoard(board) {
    return board.slice();
  }

  function indexToCoord(index) {
    return {
      row: Math.floor(index / BOARD_SIZE),
      col: index % BOARD_SIZE,
    };
  }

  function coordToIndex(row, col) {
    return row * BOARD_SIZE + col;
  }

  function inBounds(row, col) {
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
  }

  function nextPlayer(player) {
    return player === BLACK ? WHITE : BLACK;
  }

  function playerLabel(player) {
    return player === BLACK ? "Black" : "White";
  }

  function isValidMove(board, index, gameActive) {
    if (!gameActive) {
      return { ok: false, reason: "Game is already over." };
    }
    if (typeof index !== "number" || index !== Math.floor(index)) {
      return { ok: false, reason: "Cell index must be an integer." };
    }
    if (index < 0 || index >= CELL_COUNT) {
      return { ok: false, reason: "Cell index is out of range." };
    }
    if (board[index] !== EMPTY) {
      return { ok: false, reason: "Intersection is already occupied." };
    }
    return { ok: true };
  }

  /**
   * Count consecutive stones of `player` from (row,col) stepping by (dr,dc),
   * not including the starting cell itself.
   */
  function countRay(board, row, col, dr, dc, player) {
    let count = 0;
    let r = row + dr;
    let c = col + dc;
    while (inBounds(r, c) && board[coordToIndex(r, c)] === player) {
      count += 1;
      r += dr;
      c += dc;
    }
    return count;
  }

  /**
   * Collect consecutive stone indexes along a ray (not including start).
   */
  function collectRay(board, row, col, dr, dc, player) {
    const cells = [];
    let r = row + dr;
    let c = col + dc;
    while (inBounds(r, c) && board[coordToIndex(r, c)] === player) {
      cells.push(coordToIndex(r, c));
      r += dr;
      c += dc;
    }
    return cells;
  }

  /**
   * After placing a stone at `index`, check whether that stone completes
   * five or more in a row. Returns { winner, line } or null.
   * `line` contains the full consecutive run (length >= 5).
   */
  function checkWinnerFrom(board, index) {
    const player = board[index];
    if (!player) {
      return null;
    }

    const { row, col } = indexToCoord(index);

    for (let i = 0; i < DIRECTIONS.length; i += 1) {
      const dr = DIRECTIONS[i][0];
      const dc = DIRECTIONS[i][1];
      const forward = collectRay(board, row, col, dr, dc, player);
      const backward = collectRay(board, row, col, -dr, -dc, player);
      const line = backward.reverse().concat(index, forward);

      if (line.length >= 5) {
        return { winner: player, line: line };
      }
    }

    return null;
  }

  /**
   * Full-board win scan (useful for tests and verification).
   * Returns the first freestyle five-in-a-row found, or null.
   */
  function checkWinner(board) {
    for (let index = 0; index < CELL_COUNT; index += 1) {
      if (board[index] === EMPTY) {
        continue;
      }
      // Only start a scan when this cell could be the "leftmost/topmost"
      // end of a run, to avoid duplicate work — but for correctness and
      // simplicity we check from every stone; checkWinnerFrom is cheap.
      const result = checkWinnerFrom(board, index);
      if (result) {
        return result;
      }
    }
    return null;
  }

  function isDraw(board) {
    for (let i = 0; i < CELL_COUNT; i += 1) {
      if (board[i] === EMPTY) {
        return false;
      }
    }
    return true;
  }

  function getLegalMoves(board) {
    const moves = [];
    for (let i = 0; i < CELL_COUNT; i += 1) {
      if (board[i] === EMPTY) {
        moves.push(i);
      }
    }
    return moves;
  }

  /**
   * Candidate intersections near existing stones (Chebyshev distance).
   * First move falls back to the board centre.
   */
  function getCandidateMoves(board, radius) {
    const r = typeof radius === "number" ? radius : 2;
    const occupied = [];
    for (let i = 0; i < CELL_COUNT; i += 1) {
      if (board[i] !== EMPTY) {
        occupied.push(i);
      }
    }

    if (occupied.length === 0) {
      return [coordToIndex(Math.floor(BOARD_SIZE / 2), Math.floor(BOARD_SIZE / 2))];
    }

    const seen = Object.create(null);
    const candidates = [];

    for (let i = 0; i < occupied.length; i += 1) {
      const { row, col } = indexToCoord(occupied[i]);
      for (let dr = -r; dr <= r; dr += 1) {
        for (let dc = -r; dc <= r; dc += 1) {
          const nr = row + dr;
          const nc = col + dc;
          if (!inBounds(nr, nc)) {
            continue;
          }
          const idx = coordToIndex(nr, nc);
          if (board[idx] !== EMPTY || seen[idx]) {
            continue;
          }
          seen[idx] = true;
          candidates.push(idx);
        }
      }
    }

    return candidates;
  }

  /**
   * Place a stone if legal. Returns a result object; does not mutate on failure.
   * Mutates `board` on success (caller owns the board).
   */
  function applyMove(board, index, player, gameActive) {
    const validation = isValidMove(board, index, gameActive);
    if (!validation.ok) {
      return { ok: false, reason: validation.reason };
    }
    board[index] = player;
    const win = checkWinnerFrom(board, index);
    const draw = !win && isDraw(board);
    return {
      ok: true,
      win: win,
      draw: draw,
      nextPlayer: win || draw ? null : nextPlayer(player),
    };
  }

  return {
    BOARD_SIZE: BOARD_SIZE,
    CELL_COUNT: CELL_COUNT,
    BLACK: BLACK,
    WHITE: WHITE,
    EMPTY: EMPTY,
    DIRECTIONS: DIRECTIONS,
    createBoard: createBoard,
    cloneBoard: cloneBoard,
    indexToCoord: indexToCoord,
    coordToIndex: coordToIndex,
    inBounds: inBounds,
    nextPlayer: nextPlayer,
    playerLabel: playerLabel,
    isValidMove: isValidMove,
    countRay: countRay,
    checkWinnerFrom: checkWinnerFrom,
    checkWinner: checkWinner,
    isDraw: isDraw,
    getLegalMoves: getLegalMoves,
    getCandidateMoves: getCandidateMoves,
    applyMove: applyMove,
  };
});
