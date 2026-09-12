# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Classic Tetris implemented in vanilla JavaScript, HTML5 Canvas, and CSS. No dependencies, no build step, no package.json.

## Running

Open `index.html` directly, or serve statically:

```bash
python3 -m http.server 8000
# or
npx serve .
```

No build, lint, or test commands exist — there is no `package.json` or test suite.

## Architecture

Three files, no modules/bundler — `game.js` is loaded directly via `<script src="game.js">` in `index.html` and relies on global scope.

- **`index.html`** — DOM structure: `<canvas id="board">` (300×600, 10×20 grid at `BLOCK=30`px), a `<canvas id="next-canvas">` preview, HUD spans (`score`/`lines`/`level`), and the pause/game-over overlay.
- **`style.css`** — dark/retro arcade visuals.
- **`game.js`** — all game logic, organized around one mutable global state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, etc.) rather than a class or module pattern.

Key functions in `game.js`:

- `collide(shape, ox, oy)` — bounds/overlap check against `board`; the basis for all movement/rotation validity.
- `rotateCW(shape)` — rotates a piece matrix via transpose + row reversal.
- `tryRotate()` — rotates `current` and attempts wall kicks `[0, -1, 1, -2, 2]` (column offsets) until one doesn't collide.
- `lockPiece()` → `merge()` (writes piece into `board`) → `clearLines()` (scans bottom-up, splices full rows) → `spawn()` (promotes `next` to `current`, generates new `next`, calls `endGame()` if the new piece already collides).
- `loop(ts)` — `requestAnimationFrame` game loop; accumulates `dt` and advances the piece one row when `dropAccum >= dropInterval`.
- `ghostY()` — projects `current` straight down to compute the ghost-piece landing row; used both for drawing and `hardDrop()` scoring.

Pieces (`PIECES`) are square matrices indexed 1–7 (I,O,T,S,Z,J,L); `0` = empty cell, matching index = color lookup in `COLORS`. Scoring uses `LINE_SCORES = [0, 100, 300, 500, 800]` × `level`; level increases every 10 lines, and `dropInterval = max(100, 1000 - (level-1)*90)`.

Tunable constants live at the top of `game.js`: `COLS`, `ROWS`, `BLOCK`, `COLORS`, `LINE_SCORES`, `dropInterval`. If `COLS`/`ROWS`/`BLOCK` change, update the `width`/`height` of `<canvas id="board">` in `index.html` to match (`COLS × BLOCK`, `ROWS × BLOCK`).

Controls (keydown handler at bottom of `game.js`): arrows move/rotate, `↓` soft drop, `Space` hard drop, `P` pause — all read from `e.code`.
