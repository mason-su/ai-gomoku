/**
 * Gomoku UI — wires game rules + AI to the DOM.
 * Requires GomokuGame and GomokuAI (loaded via script tags).
 */
(function () {
  "use strict";

  if (typeof document === "undefined") {
    return;
  }

  const Game = window.GomokuGame;
  const AI = window.GomokuAI;

  const boardEl = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const scoreBlackEl = document.getElementById("score-black");
  const scoreWhiteEl = document.getElementById("score-white");
  const scoreDrawsEl = document.getElementById("score-draws");
  const restartBtn = document.getElementById("restart-btn");
  const resetScoresBtn = document.getElementById("reset-scores-btn");
  const modeSelect = document.getElementById("mode-select");
  const sideSelect = document.getElementById("side-select");
  const sideBar = document.getElementById("side-bar");
  const hintEl = document.getElementById("play-hint");

  const state = {
    board: Game.createBoard(),
    currentPlayer: Game.BLACK,
    gameActive: true,
    winningLine: null,
    lastMove: null,
    aiThinking: false,
    mode: modeSelect.value,
    humanColor: sideSelect.value === "white" ? Game.WHITE : Game.BLACK,
    scores: { B: 0, W: 0, draws: 0 },
    moveToken: 0,
  };

  const intersectionButtons = [];

  function isAiMode() {
    return state.mode !== "pvp";
  }

  function aiDifficulty() {
    return state.mode;
  }

  function aiColor() {
    return state.humanColor === Game.BLACK ? Game.WHITE : Game.BLACK;
  }

  function syncSideControls() {
    const ai = isAiMode();
    sideBar.hidden = !ai;
    sideSelect.disabled = !ai;
    if (ai) {
      hintEl.textContent =
        "Stones are placed on intersections. Choose Black to move first, or White to let the AI open.";
    } else {
      hintEl.textContent =
        "Stones are placed on intersections. In Player vs Player, Black always moves first.";
    }
  }

  function buildBoard() {
    boardEl.innerHTML = "";
    intersectionButtons.length = 0;

    const lines = document.createElement("div");
    lines.className = "board-lines";
    lines.setAttribute("aria-hidden", "true");
    boardEl.appendChild(lines);

    for (let i = 0; i < Game.CELL_COUNT; i += 1) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "intersection";
      btn.dataset.index = String(i);
      btn.setAttribute("role", "gridcell");
      const coord = Game.indexToCoord(i);
      btn.setAttribute(
        "aria-label",
        "Row " + (coord.row + 1) + ", column " + (coord.col + 1)
      );
      boardEl.appendChild(btn);
      intersectionButtons.push(btn);
    }
  }

  function updateScores() {
    scoreBlackEl.textContent = String(state.scores.B);
    scoreWhiteEl.textContent = String(state.scores.W);
    scoreDrawsEl.textContent = String(state.scores.draws);
  }

  function setStatus(message, mode) {
    statusEl.textContent = message;
    statusEl.classList.remove("is-win", "is-draw", "is-thinking");
    if (mode) {
      statusEl.classList.add(mode);
    }
  }

  function humanMayInteract() {
    if (!state.gameActive || state.aiThinking) {
      return false;
    }
    if (isAiMode() && state.currentPlayer !== state.humanColor) {
      return false;
    }
    return true;
  }

  function renderBoard() {
    const locked = !humanMayInteract();
    boardEl.classList.toggle("is-locked", locked);

    for (let i = 0; i < Game.CELL_COUNT; i += 1) {
      const btn = intersectionButtons[i];
      const value = state.board[i];
      btn.classList.remove("has-stone", "is-winning", "is-last");
      btn.innerHTML = "";

      if (value === Game.BLACK || value === Game.WHITE) {
        btn.classList.add("has-stone");
        const stone = document.createElement("span");
        stone.className =
          "stone " + (value === Game.BLACK ? "stone-black" : "stone-white");
        stone.setAttribute("aria-hidden", "true");
        btn.appendChild(stone);
      }

      if (state.winningLine && state.winningLine.indexOf(i) !== -1) {
        btn.classList.add("is-winning");
      }

      if (state.lastMove === i) {
        btn.classList.add("is-last");
      }

      const occupied = value !== Game.EMPTY;
      btn.disabled = locked || occupied || !state.gameActive;
    }
  }

  function endWithWinner(result) {
    state.gameActive = false;
    state.winningLine = result.line;
    state.aiThinking = false;
    state.scores[result.winner] += 1;
    updateScores();
    setStatus(Game.playerLabel(result.winner) + " wins!", "is-win");
    renderBoard();
  }

  function endWithDraw() {
    state.gameActive = false;
    state.winningLine = null;
    state.aiThinking = false;
    state.scores.draws += 1;
    updateScores();
    setStatus("It's a draw!", "is-draw");
    renderBoard();
  }

  function announceTurn() {
    if (!isAiMode()) {
      setStatus(Game.playerLabel(state.currentPlayer) + "'s turn");
      return;
    }

    if (state.currentPlayer === aiColor()) {
      setStatus(
        Game.playerLabel(aiColor()) + " (AI) is thinking…",
        "is-thinking"
      );
      return;
    }

    setStatus("Your turn (" + Game.playerLabel(state.humanColor) + ")");
  }

  function applyHumanOrSharedMove(index) {
    const validation = Game.isValidMove(state.board, index, state.gameActive);
    if (!validation.ok) {
      return false;
    }

    state.board[index] = state.currentPlayer;
    state.lastMove = index;

    const win = Game.checkWinnerFrom(state.board, index);
    if (win) {
      endWithWinner(win);
      return true;
    }

    if (Game.isDraw(state.board)) {
      endWithDraw();
      return true;
    }

    state.currentPlayer = Game.nextPlayer(state.currentPlayer);
    announceTurn();
    renderBoard();
    return true;
  }

  function scheduleAiMove() {
    if (!isAiMode() || !state.gameActive || state.currentPlayer !== aiColor()) {
      return;
    }

    const side = aiColor();
    state.aiThinking = true;
    state.moveToken += 1;
    const token = state.moveToken;
    announceTurn();
    renderBoard();

    const boardSnapshot = Game.cloneBoard(state.board);
    AI.chooseMove(boardSnapshot, side, aiDifficulty()).then(function (move) {
      if (token !== state.moveToken) {
        return;
      }

      state.aiThinking = false;

      if (!state.gameActive || state.currentPlayer !== side) {
        renderBoard();
        return;
      }

      if (!AI.isLegalAiMove(state.board, move)) {
        move = AI.getEasyMove(state.board, side);
      }

      if (move === null || !AI.isLegalAiMove(state.board, move)) {
        setStatus("AI could not find a move.", "is-draw");
        renderBoard();
        return;
      }

      applyHumanOrSharedMove(move);
    });
  }

  function handleIntersectionClick(index) {
    if (!humanMayInteract()) {
      return;
    }
    if (!applyHumanOrSharedMove(index)) {
      return;
    }
    scheduleAiMove();
  }

  function restartGame() {
    state.moveToken += 1;
    state.board = Game.createBoard();
    state.currentPlayer = Game.BLACK;
    state.gameActive = true;
    state.winningLine = null;
    state.lastMove = null;
    state.aiThinking = false;
    announceTurn();
    renderBoard();

    // Human chose White → AI (Black) opens.
    if (isAiMode() && state.humanColor === Game.WHITE) {
      scheduleAiMove();
    }
  }

  function resetScores() {
    state.scores = { B: 0, W: 0, draws: 0 };
    updateScores();
    restartGame();
  }

  function onModeChange() {
    state.mode = modeSelect.value;
    syncSideControls();
    restartGame();
  }

  function onSideChange() {
    state.humanColor = sideSelect.value === "white" ? Game.WHITE : Game.BLACK;
    restartGame();
  }

  boardEl.addEventListener("click", function (event) {
    const btn = event.target.closest(".intersection");
    if (!btn || !boardEl.contains(btn)) {
      return;
    }
    handleIntersectionClick(Number(btn.dataset.index));
  });

  restartBtn.addEventListener("click", restartGame);
  resetScoresBtn.addEventListener("click", resetScores);
  modeSelect.addEventListener("change", onModeChange);
  sideSelect.addEventListener("change", onSideChange);

  buildBoard();
  syncSideControls();
  updateScores();
  announceTurn();
  renderBoard();

  if (isAiMode() && state.humanColor === Game.WHITE) {
    scheduleAiMove();
  }
})();
