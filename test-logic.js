"use strict";

const Game = require("./js/game.js");
const AI = require("./js/ai.js");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log("PASS:", message);
  } else {
    failed += 1;
    console.error("FAIL:", message);
  }
}

function place(board, row, col, player) {
  board[Game.coordToIndex(row, col)] = player;
}

function emptyBoard() {
  return Game.createBoard();
}

// --- Board helpers ---
assert(Game.BOARD_SIZE === 15, "board size is 15");
assert(Game.CELL_COUNT === 225, "board has 225 intersections");
assert(Game.coordToIndex(0, 0) === 0, "top-left index is 0");
assert(Game.coordToIndex(14, 14) === 224, "bottom-right index is 224");
assert(
  Game.indexToCoord(112).row === 7 && Game.indexToCoord(112).col === 7,
  "centre maps to (7,7)"
);

// --- Illegal moves ---
(function () {
  const board = emptyBoard();
  place(board, 7, 7, Game.BLACK);

  assert(
    Game.isValidMove(board, Game.coordToIndex(7, 7), true).ok === false,
    "rejects overlapping stone"
  );
  assert(
    Game.isValidMove(board, -1, true).ok === false,
    "rejects negative index"
  );
  assert(
    Game.isValidMove(board, 225, true).ok === false,
    "rejects out-of-range index"
  );
  assert(
    Game.isValidMove(board, Game.coordToIndex(7, 8), false).ok === false,
    "rejects moves after game over"
  );
  assert(
    Game.isValidMove(board, Game.coordToIndex(7, 8), true).ok === true,
    "allows empty intersection while game is active"
  );
})();

// --- Win detection: rows, columns, diagonals, freestyle 5+ ---
(function () {
  const rowBoard = emptyBoard();
  for (let c = 3; c <= 7; c += 1) {
    place(rowBoard, 5, c, Game.BLACK);
  }
  const rowWin = Game.checkWinnerFrom(rowBoard, Game.coordToIndex(5, 5));
  assert(rowWin && rowWin.winner === Game.BLACK, "detects horizontal five for Black");
  assert(rowWin.line.length >= 5, "winning line has at least five cells");

  const colBoard = emptyBoard();
  for (let r = 2; r <= 6; r += 1) {
    place(colBoard, r, 4, Game.WHITE);
  }
  assert(
    Game.checkWinnerFrom(colBoard, Game.coordToIndex(4, 4)).winner === Game.WHITE,
    "detects vertical five for White"
  );

  const diagBoard = emptyBoard();
  for (let i = 0; i < 5; i += 1) {
    place(diagBoard, 1 + i, 1 + i, Game.BLACK);
  }
  assert(
    Game.checkWinnerFrom(diagBoard, Game.coordToIndex(3, 3)).winner === Game.BLACK,
    "detects main-diagonal five"
  );

  const antiBoard = emptyBoard();
  for (let i = 0; i < 5; i += 1) {
    place(antiBoard, 2 + i, 10 - i, Game.WHITE);
  }
  assert(
    Game.checkWinnerFrom(antiBoard, Game.coordToIndex(4, 8)).winner === Game.WHITE,
    "detects anti-diagonal five"
  );

  const sixBoard = emptyBoard();
  for (let c = 1; c <= 6; c += 1) {
    place(sixBoard, 8, c, Game.BLACK);
  }
  const sixWin = Game.checkWinnerFrom(sixBoard, Game.coordToIndex(8, 3));
  assert(
    sixWin && sixWin.line.length === 6,
    "freestyle: six-in-a-row still counts as a win"
  );

  const fourBoard = emptyBoard();
  for (let c = 0; c < 4; c += 1) {
    place(fourBoard, 0, c, Game.BLACK);
  }
  assert(
    Game.checkWinnerFrom(fourBoard, Game.coordToIndex(0, 1)) === null,
    "four-in-a-row is not a win"
  );
})();

// --- Draw helper ---
(function () {
  const board = emptyBoard();
  assert(Game.isDraw(board) === false, "empty board is not a draw");
  for (let i = 0; i < Game.CELL_COUNT; i += 1) {
    board[i] = i % 2 === 0 ? Game.BLACK : Game.WHITE;
  }
  // Full board may also contain wins; isDraw only checks fullness.
  assert(Game.isDraw(board) === true, "full board reports draw fullness");
})();

// --- Turn helper ---
assert(Game.nextPlayer(Game.BLACK) === Game.WHITE, "Black switches to White");
assert(Game.nextPlayer(Game.WHITE) === Game.BLACK, "White switches to Black");

// --- Candidate generation ---
(function () {
  const empty = emptyBoard();
  const first = Game.getCandidateMoves(empty, 2);
  assert(
    first.length === 1 && first[0] === Game.coordToIndex(7, 7),
    "first candidate is the centre"
  );

  place(empty, 7, 7, Game.BLACK);
  const near = Game.getCandidateMoves(empty, 1);
  assert(near.indexOf(Game.coordToIndex(7, 8)) !== -1, "includes neighbour cells");
  assert(near.indexOf(Game.coordToIndex(7, 7)) === -1, "excludes occupied cells");
  assert(near.length < Game.CELL_COUNT, "candidates are fewer than all intersections");
})();

// --- AI move validity ---
(function () {
  const board = emptyBoard();
  place(board, 7, 7, Game.BLACK);

  const easy = AI.getEasyMove(board, Game.WHITE);
  assert(AI.isLegalAiMove(board, easy), "Easy AI returns a legal empty cell");

  const medium = AI.getMediumMove(board, Game.WHITE);
  assert(AI.isLegalAiMove(board, medium), "Medium AI returns a legal empty cell");

  // Medium should block an open four when possible.
  const threat = emptyBoard();
  for (let c = 3; c <= 6; c += 1) {
    place(threat, 7, c, Game.BLACK);
  }
  const block = AI.getMediumMove(threat, Game.WHITE);
  const blockCoord = Game.indexToCoord(block);
  const blocksThreat =
    blockCoord.row === 7 && (blockCoord.col === 2 || blockCoord.col === 7);
  assert(blocksThreat, "Medium AI blocks an open four on the same row");
})();

// --- Easy AI: forced win, forced block, legality, weighted randomness ---
(function () {
  // Immediate win: White has four in a row with an open end.
  const winBoard = emptyBoard();
  for (let c = 3; c <= 6; c += 1) {
    place(winBoard, 7, c, Game.WHITE);
  }
  place(winBoard, 0, 0, Game.BLACK); // so candidates are not "first move only"
  const winMove = AI.getEasyMove(winBoard, Game.WHITE, { random: function () { return 0; } });
  const winCoord = Game.indexToCoord(winMove);
  assert(
    winCoord.row === 7 && (winCoord.col === 2 || winCoord.col === 7),
    "Easy AI takes an immediate winning move"
  );

  // Immediate block: Black threatens four; White must block.
  const blockBoard = emptyBoard();
  for (let c = 3; c <= 6; c += 1) {
    place(blockBoard, 7, c, Game.BLACK);
  }
  const easyBlock = AI.getEasyMove(blockBoard, Game.WHITE, {
    random: function () {
      return 0.99;
    },
  });
  const easyBlockCoord = Game.indexToCoord(easyBlock);
  assert(
    easyBlockCoord.row === 7 &&
      (easyBlockCoord.col === 2 || easyBlockCoord.col === 7),
    "Easy AI blocks an opponent immediate win"
  );

  // Legal moves on a mid-game board (repeated draws).
  const legalBoard = emptyBoard();
  place(legalBoard, 7, 7, Game.BLACK);
  place(legalBoard, 7, 8, Game.WHITE);
  let allLegal = true;
  for (let i = 0; i < 20; i += 1) {
    const move = AI.getEasyMove(legalBoard, Game.WHITE);
    if (!AI.isLegalAiMove(legalBoard, move)) {
      allLegal = false;
      break;
    }
  }
  assert(allLegal, "Easy AI only returns legal moves across repeated calls");

  // Weighted selection: equal scores → uniform buckets; r picks 1st / last.
  const equalScores = [
    { index: 11, score: 100 },
    { index: 22, score: 100 },
    { index: 33, score: 100 },
  ];
  assert(
    AI.pickWeightedIndex(equalScores, function () { return 0; }, AI.EASY_DEFAULTS) === 11,
    "weighted random with r=0 selects the first equal-score candidate"
  );
  assert(
    AI.pickWeightedIndex(equalScores, function () { return 0.999; }, AI.EASY_DEFAULTS) === 33,
    "weighted random with r≈1 selects the last equal-score candidate"
  );

  // Higher score gets the first lottery slot (r=0).
  const skewed = [
    { index: 10, score: 1000 },
    { index: 20, score: 10 },
  ];
  assert(
    AI.pickWeightedIndex(skewed, function () { return 0; }, AI.EASY_DEFAULTS) === 10,
    "weighted random with r=0 prefers the higher-scored candidate"
  );

  // TOP_CANDIDATE_COUNT=1 ignores random (only one weighted option).
  const quiet = emptyBoard();
  place(quiet, 7, 7, Game.BLACK);
  const easyA = AI.getEasyMove(quiet, Game.WHITE, {
    TOP_CANDIDATE_COUNT: 1,
    random: function () {
      return 0;
    },
  });
  const easyB = AI.getEasyMove(quiet, Game.WHITE, {
    TOP_CANDIDATE_COUNT: 1,
    random: function () {
      return 0.99;
    },
  });
  assert(
    easyA === easyB && AI.isLegalAiMove(quiet, easyA),
    "Easy with TOP_CANDIDATE_COUNT=1 is deterministic and legal"
  );
})();

// --- Hard AI (async) ---
AI.getHardMove(emptyBoard(), Game.WHITE, { maxDepth: 1, yieldMs: 0 }).then(
  function (result) {
    assert(
      AI.isLegalAiMove(emptyBoard(), result.move),
      "Hard AI returns a legal move on empty board"
    );

    const mid = emptyBoard();
    place(mid, 7, 7, Game.BLACK);
    return AI.getHardMove(mid, Game.WHITE, { maxDepth: 2, yieldMs: 0 }).then(
      function (hard) {
        assert(
          AI.isLegalAiMove(mid, hard.move),
          "Hard AI returns a legal move mid-game"
        );
        assert(typeof hard.nodes === "number" && hard.nodes > 0, "Hard AI reports node count");

        console.log("");
        console.log("Result:", passed, "passed,", failed, "failed");
        process.exit(failed === 0 ? 0 : 1);
      }
    );
  }
).catch(function (err) {
  console.error("FAIL: Hard AI promise rejected", err);
  process.exit(1);
});
