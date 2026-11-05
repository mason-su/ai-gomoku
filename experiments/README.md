# Local AI benchmarking (developer only)

This folder is **not** part of the GitHub Pages site. It runs headless games in Node.js using the same `js/game.js` and `js/ai.js` as the web app.

**300-game results (tables + charts)** are documented in the project README:  
[../README.md#benchmark-results-300-games](../README.md#benchmark-results-300-games)

## Quick start

From the repository root:

```bash
# Validate wiring with a tiny sample (12 games)
node experiments/run-benchmark.js --smoke --seed 42

# Full experiment: 3 matchups × 100 games = 300
node experiments/run-benchmark.js --all --seed 42

# Continue an interrupted run
node experiments/run-benchmark.js --resume
```

Automated checks for the harness:

```bash
node experiments/test-benchmark.js
```

## Matchups

| Pair | Games | Colour balance |
|------|-------|----------------|
| Easy vs Medium | 100 | 50 each as Black |
| Easy vs Hard | 100 | 50 each as Black |
| Medium vs Hard | 100 | 50 each as Black |

## Outputs

Written under `experiments/results/` (gitignored machine artefacts):

- `checkpoint.json` — progress for `--resume`
- `benchmark-*.json` — full structured results
- `benchmark-*.csv` — per-game rows
- `report-*.md` — auto-generated Markdown from each run

## Notes

- Observed win rates ≠ theoretical strength proofs.
- Prefer reporting results **by colour** as well as overall.
- Hard AI search depth defaults to 2 (`--hard-depth` to override).
