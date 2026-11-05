/**
 * Gomoku UI — wires game rules + AI to the DOM.
 * Modes: PvP, vs AI (easy/medium/hard), AI vs AI spectator.
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
  const spectatorBar = document.getElementById("spectator-bar");
  const blackAiSelect = document.getElementById("black-ai-select");
  const whiteAiSelect = document.getElementById("white-ai-select");
  const speedSelect = document.getElementById("speed-select");
  const specStartBtn = document.getElementById("spec-start-btn");
  const specPauseBtn = document.getElementById("spec-pause-btn");
  const specResumeBtn = document.getElementById("spec-resume-btn");
  const specRestartBtn = document.getElementById("spec-restart-btn");

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
    spectator: {
      running: false,
      paused: false,
      blackDiff: blackAiSelect.value,
      whiteDiff: whiteAiSelect.value,
      speedMs: Number(speedSelect.value) || 650,
    },
  };

  const intersectionButtons = [];

  function isHumanAiMode() {
    return (
      state.mode === "easy" ||
      state.mode === "medium" ||
      state.mode === "hard"
    );
  }

  function isSpectatorMode() {
    return state.mode === "aivsai";
  }

  function aiDifficulty() {
    return state.mode;
  }

  function aiColor() {
    return state.humanColor === Game.BLACK ? Game.WHITE : Game.BLACK;
  }

  function cancelPendingAi() {
    state.moveToken += 1;
    state.aiThinking = false;
  }

  function syncControlsVisibility() {
    const humanAi = isHumanAiMode();
    const spectate = isSpectatorMode();

    sideBar.hidden = !humanAi;
    sideSelect.disabled = !humanAi;
    spectatorBar.hidden = !spectate;

    // Bottom restart still useful; in spectator prefer the spectator Restart.
    restartBtn.disabled = spectate;

    if (spectate) {
      hintEl.textContent =
        "Spectator mode: pick difficulties for Black and White, then Start. The board is view-only.";
    } else if (humanAi) {
      hintEl.textContent =
        "Stones are placed on intersections. Choose Black to move first, or White to let the AI open.";
    } else {
      hintEl.textContent =
        "Stones are placed on intersections. In Player vs Player, Black always moves first.";
    }

    syncSpectatorButtons();
  }

  function syncSpectatorButtons() {
    if (!isSpectatorMode()) {
      return;
    }
    const running = state.spectator.running;
    const paused = state.spectator.paused;
    specStartBtn.disabled = running && !paused;
    specPauseBtn.disabled = !running || paused || !state.gameActive;
    specResumeBtn.disabled = !running || !paused || !state.gameActive;
    blackAiSelect.disabled = running && !paused;
    whiteAiSelect.disabled = running && !paused;
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
    if (isSpectatorMode()) {
      return false;
    }
    if (!state.gameActive || state.aiThinking) {
      return false;
    }
    if (isHumanAiMode() && state.currentPlayer !== state.humanColor) {
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

    if (isSpectatorMode()) {
      state.spectator.running = false;
      state.spectator.paused = false;
      const label =
        result.winner === Game.BLACK
          ? "Black (" + state.spectator.blackDiff + ")"
          : "White (" + state.spectator.whiteDiff + ")";
      setStatus(label + " wins!", "is-win");
      syncSpectatorButtons();
    } else {
      setStatus(Game.playerLabel(result.winner) + " wins!", "is-win");
    }
    renderBoard();
  }

  function endWithDraw() {
    state.gameActive = false;
    state.winningLine = null;
    state.aiThinking = false;
    state.scores.draws += 1;
    updateScores();
    if (isSpectatorMode()) {
      state.spectator.running = false;
      state.spectator.paused = false;
      syncSpectatorButtons();
    }
    setStatus("It's a draw!", "is-draw");
    renderBoard();
  }

  function announceTurn() {
    if (isSpectatorMode()) {
      if (state.spectator.paused) {
        setStatus("Paused — " + Game.playerLabel(state.currentPlayer) + " to move");
        return;
      }
      if (state.spectator.running && state.gameActive) {
        const diff =
          state.currentPlayer === Game.BLACK
            ? state.spectator.blackDiff
            : state.spectator.whiteDiff;
        setStatus(
          Game.playerLabel(state.currentPlayer) +
            " (" +
            diff +
            " AI) is thinking…",
          "is-thinking"
        );
        return;
      }
      setStatus(
        "Ready — " +
          Game.playerLabel(state.currentPlayer) +
          " to move. Press Start."
      );
      return;
    }

    if (!isHumanAiMode()) {
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

  function applyMove(index) {
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

  function scheduleHumanOpponentAi() {
    if (
      !isHumanAiMode() ||
      !state.gameActive ||
      state.currentPlayer !== aiColor()
    ) {
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

      applyMove(move);
    });
  }

  function delay(ms, token) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve(token === state.moveToken);
      }, ms);
    });
  }

  function scheduleSpectatorTurn() {
    if (
      !isSpectatorMode() ||
      !state.spectator.running ||
      state.spectator.paused ||
      !state.gameActive
    ) {
      return;
    }

    const side = state.currentPlayer;
    const difficulty =
      side === Game.BLACK
        ? state.spectator.blackDiff
        : state.spectator.whiteDiff;

    state.aiThinking = true;
    state.moveToken += 1;
    const token = state.moveToken;
    announceTurn();
    renderBoard();
    syncSpectatorButtons();

    const boardSnapshot = Game.cloneBoard(state.board);
    const thinkPromise = AI.chooseMove(boardSnapshot, side, difficulty, {
      yieldMs: 0,
    });

    Promise.all([thinkPromise, delay(state.spectator.speedMs, token)]).then(
      function (results) {
        const move = results[0];
        const stillCurrent = results[1];

        if (!stillCurrent || token !== state.moveToken) {
          return;
        }

        state.aiThinking = false;

        if (
          !isSpectatorMode() ||
          !state.spectator.running ||
          state.spectator.paused ||
          !state.gameActive ||
          state.currentPlayer !== side
        ) {
          renderBoard();
          syncSpectatorButtons();
          return;
        }

        let playMove = move;
        if (!AI.isLegalAiMove(state.board, playMove)) {
          playMove = AI.getEasyMove(state.board, side);
        }

        if (playMove === null || !AI.isLegalAiMove(state.board, playMove)) {
          setStatus("Spectator AI could not find a move.", "is-draw");
          state.spectator.running = false;
          syncSpectatorButtons();
          renderBoard();
          return;
        }

        applyMove(playMove);

        if (state.gameActive && state.spectator.running && !state.spectator.paused) {
          scheduleSpectatorTurn();
        } else {
          syncSpectatorButtons();
        }
      }
    );
  }

  function handleIntersectionClick(index) {
    if (!humanMayInteract()) {
      return;
    }
    if (!applyMove(index)) {
      return;
    }
    scheduleHumanOpponentAi();
  }

  function resetBoardState() {
    cancelPendingAi();
    state.board = Game.createBoard();
    state.currentPlayer = Game.BLACK;
    state.gameActive = true;
    state.winningLine = null;
    state.lastMove = null;
  }

  function restartGame() {
    resetBoardState();
    if (isSpectatorMode()) {
      state.spectator.running = false;
      state.spectator.paused = false;
      announceTurn();
      renderBoard();
      syncSpectatorButtons();
      return;
    }

    announceTurn();
    renderBoard();

    if (isHumanAiMode() && state.humanColor === Game.WHITE) {
      scheduleHumanOpponentAi();
    }
  }

  function resetScores() {
    state.scores = { B: 0, W: 0, draws: 0 };
    updateScores();
    restartGame();
  }

  function onModeChange() {
    cancelPendingAi();
    state.mode = modeSelect.value;
    state.spectator.running = false;
    state.spectator.paused = false;
    syncControlsVisibility();
    restartGame();
  }

  function onSideChange() {
    state.humanColor = sideSelect.value === "white" ? Game.WHITE : Game.BLACK;
    restartGame();
  }

  function onSpectatorDiffChange() {
    state.spectator.blackDiff = blackAiSelect.value;
    state.spectator.whiteDiff = whiteAiSelect.value;
    if (isSpectatorMode() && !state.spectator.running) {
      announceTurn();
    }
  }

  function onSpeedChange() {
    state.spectator.speedMs = Number(speedSelect.value) || 650;
  }

  function onSpecStart() {
    if (!isSpectatorMode()) {
      return;
    }
    state.spectator.blackDiff = blackAiSelect.value;
    state.spectator.whiteDiff = whiteAiSelect.value;
    state.spectator.speedMs = Number(speedSelect.value) || 650;

    if (!state.gameActive) {
      resetBoardState();
    }

    state.spectator.running = true;
    state.spectator.paused = false;
    syncSpectatorButtons();
    scheduleSpectatorTurn();
  }

  function onSpecPause() {
    if (!isSpectatorMode() || !state.spectator.running) {
      return;
    }
    state.spectator.paused = true;
    cancelPendingAi();
    announceTurn();
    renderBoard();
    syncSpectatorButtons();
  }

  function onSpecResume() {
    if (
      !isSpectatorMode() ||
      !state.spectator.running ||
      !state.spectator.paused ||
      !state.gameActive
    ) {
      return;
    }
    state.spectator.paused = false;
    syncSpectatorButtons();
    scheduleSpectatorTurn();
  }

  function onSpecRestart() {
    if (!isSpectatorMode()) {
      return;
    }
    cancelPendingAi();
    state.spectator.running = false;
    state.spectator.paused = false;
    resetBoardState();
    announceTurn();
    renderBoard();
    syncSpectatorButtons();
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
  blackAiSelect.addEventListener("change", onSpectatorDiffChange);
  whiteAiSelect.addEventListener("change", onSpectatorDiffChange);
  speedSelect.addEventListener("change", onSpeedChange);
  specStartBtn.addEventListener("click", onSpecStart);
  specPauseBtn.addEventListener("click", onSpecPause);
  specResumeBtn.addEventListener("click", onSpecResume);
  specRestartBtn.addEventListener("click", onSpecRestart);

  buildBoard();
  syncControlsVisibility();
  updateScores();
  announceTurn();
  renderBoard();

  if (isHumanAiMode() && state.humanColor === Game.WHITE) {
    scheduleHumanOpponentAi();
  }
})();
