# Gomoku (Five in a Row)

A browser-based Gomoku game built as an AI Engineering learning project with Cursor Agent. Play locally against another person or against three built-in AI difficulty levels. No frameworks, bundlers, external AI APIs, or server backends are required.

Portfolio index: [ai-agent-learning](https://github.com/mason-su/ai-agent-learning)

## Live Demo

- **Play online:** [https://mason-su.github.io/ai-gomoku/](https://mason-su.github.io/ai-gomoku/)
- **Status:** Deployed and verified

## Features

- Responsive 15×15 Gomoku board (desktop and mobile)
- Stones placed on **grid intersections**, not inside squares
- Freestyle rules: five or more consecutive stones wins; no forbidden moves
- Player vs Player mode
- Player vs AI with Easy / Medium / Hard difficulties
- Human always plays **Black** and moves first in AI games
- Winning-line highlight, last-move marker, and live turn status
- Restart Game and Reset Scores controls
- Invalid-move prevention and UI lock during AI turns
- Automated Node tests for rules and AI move validity
- GitHub Pages compatible (relative asset paths, no build step)

## Technologies

- HTML5 / CSS3 / Vanilla JavaScript
- Modular IIFE scripts shared by the browser and Node tests
- Heuristic evaluation + Minimax with Alpha-Beta pruning (Hard AI)

---

## Project Structure (where everything lives)

```text
ai-gomoku/
├── index.html      # Page shell: title, mode selector, scoreboard, board host, controls
├── styles.css      # Layout, wood board, grid lines, stones, responsive rules
├── script.js       # UI / game loop only — wires DOM events to rules + AI
├── js/
│   ├── game.js     # Pure game rules (no DOM): board, legality, win/draw, candidates
│   └── ai.js       # Pure AI (no DOM): Easy / Medium / Hard move selection
├── test-logic.js   # Automated tests run with Node
└── README.md       # This file
```

| File | Responsibility |
|------|----------------|
| `index.html` | Markup only. Mode dropdown, scoreboard, empty `#board` container, buttons. |
| `styles.css` | Visual board: wood background, lines through intersection centres, black/white stones, win highlight. |
| `script.js` | Creates 225 intersection buttons, tracks turn / scores / AI-thinking lock, calls `GomokuGame` and `GomokuAI`. |
| `js/game.js` | Source of truth for freestyle rules. Safe to unit-test without a browser. |
| `js/ai.js` | Depends on `game.js`. Exports Easy / Medium / Hard choosers. |
| `test-logic.js` | Requires the `js/` modules under Node and asserts rules + AI behaviour. |

**Design choice:** rules and AI stay DOM-free so the same code runs in the browser (via `<script>` tags) and in `node test-logic.js`. The UI never re-implements win detection or move legality.

Load order in the browser:

```html
<script src="./js/game.js"></script>
<script src="./js/ai.js"></script>
<script src="./script.js"></script>
```

---

## Game Rules (Freestyle Gomoku)

1. Black and White alternate on empty intersections of a 15×15 grid.
2. Black always starts (in AI modes, the human is Black).
3. The first player to form an unbroken line of **five or more** stones — horizontally, vertically, or diagonally — wins.
4. There are **no** renju-style forbidden moves.
5. If every intersection is filled with no winner, the game is a draw.

Win checks run from the **last placed stone** along four axes, which is fast and returns the full consecutive line for highlighting.

---

## AI Architecture

All AI runs **locally in the browser**. Nothing is sent to an API.

| Level | Strategy | Typical use |
|-------|----------|-------------|
| **Easy** | Random legal move among nearby candidates | Baseline / casual |
| **Medium** | Greedy heuristic: attack score + defence score | Solid blocker / attacker |
| **Hard** | Depth-limited Minimax + Alpha-Beta + heuristics + candidate filter | Demonstrates classic game-tree search |

### 1. Candidate move generation (shared)

Searching all **225** intersections at every step is wasteful. Instead:

- Collect empty points within **Chebyshev distance ≤ 2** of any existing stone.
- On an empty board, the only candidate is the **centre (7, 7)**.

This keeps Medium scoring cheap and makes Hard’s branching factor tractable.

Implementation: `GomokuGame.getCandidateMoves(board, radius)` in `js/game.js`.

### 2. Pattern heuristic (Medium & Hard)

For a focus intersection and a player colour, the evaluator looks along each of the four directions and scores **consecutive length** plus **open ends** (0–2 empty sides):

| Pattern idea | Relative value |
|--------------|----------------|
| Five or more | Immediate win |
| Open four | Extremely high |
| Closed four | High |
| Open three | Medium-high |
| Smaller shapes | Low |

**Medium** ranks each candidate as roughly:

`attack(placing my stone) × 1.1 + defence(if opponent placed there)`

Then picks a top-scoring move (ties broken randomly). That is why Medium will usually **block an open four**.

Implementation: `patternScore`, `scoreMoveForPlayer`, `rankMove`, `getMediumMove` in `js/ai.js`.

### 3. Easy AI

`getEasyMove` picks uniformly at random from the candidate set (fallback: any empty cell). No evaluation.

### 4. Hard AI — Minimax + Alpha-Beta

Hard builds on the same candidates and heuristic:

1. **Yield to the UI** with a short `setTimeout` so the status can show “thinking…” before the CPU-heavy work starts.
2. **Iterative deepening** to depth **1**, then **2** (shallow on purpose so the tab stays responsive).
3. At each node:
   - Generate candidates.
   - Sort by the Medium-style heuristic.
   - Keep only the **top N** moves (branch cap).
   - Recurse with **Alpha-Beta pruning**.
4. Terminal wins/losses inside the tree get large positive/negative scores; depth-0 leaves use `evaluateBoard`.
5. Returns a legal move index (with node-count stats available from `getHardMove`).

This is a **teaching-strength** engine: readable and testable, not a tournament bot. Extending depth, adding transposition tables, or threat-space search would be natural next steps.

Implementation: `minimax`, `getHardMove`, `chooseMove` in `js/ai.js`.

### 5. UI safety around AI turns

In `script.js`:

- While `aiThinking` is true, the board is locked (`pointer-events` + disabled intersections).
- In AI modes, clicks are ignored when it is White’s turn.
- AI results are ignored if the player restarted mid-search (`moveToken`).
- Illegal AI results fall back to Easy so the game never soft-locks.

---

## How to Run Locally

1. Clone the repository:

```bash
git clone https://github.com/mason-su/ai-gomoku.git
cd ai-gomoku
```

2. Open `index.html` in your browser:
   - Double-click the file, or
   - Drag it into a browser window, or
   - Open the file URL for your clone path

No package manager or local server is required.

### Optional static server

```bash
npx --yes serve .
```

Then open the URL printed in the terminal.

---

## Automated Tests

With [Node.js](https://nodejs.org/) installed:

```bash
node test-logic.js
```

Coverage includes:

- Board indexing helpers (15×15 / 225 intersections)
- Win detection (row, column, both diagonals, freestyle six-in-a-row)
- Non-wins (four-in-a-row)
- Illegal moves (overlap, out of range, game already over)
- Candidate generation (centre opening, neighbours only)
- Easy / Medium / Hard AI returning legal empty cells
- Medium AI blocking an open four

---

## GitHub Pages Deployment

1. Push this repository to GitHub (`main` branch).
2. Open the repository on GitHub → **Settings** → **Pages**.
3. Under **Build and deployment**:
   - Source: **Deploy from a branch**
   - Branch: `main`
   - Folder: `/ (root)`
4. Click **Save**.
5. Wait one or two minutes, then open:
   `https://mason-su.github.io/ai-gomoku/`
6. After the page loads successfully, mark the **Live Demo** section above as verified.

All assets use relative paths (`./styles.css`, `./js/game.js`, …), so the same files work from disk and from GitHub Pages.

---

## How to Play

1. Choose a mode (PvP or vs AI difficulty).
2. Click an empty intersection to place a stone.
3. In AI modes you are Black; White moves automatically after you.
4. A winning five-or-more line is highlighted when the game ends.
5. Use **Restart Game** for a new round (scores kept).
6. Use **Reset Scores** to clear the scoreboard and start fresh.

---

## Learning Notes

This project prioritises **readable, testable modules** over maximum playing strength. Separating `game.js`, `ai.js`, and `script.js` makes it clear where rules end and search begins — a useful pattern before moving on to larger agent systems.

Natural extensions: deeper Hard search with a time budget, threat detection, undo, or a stronger opening book.

## License

Shared for learning and portfolio purposes.
