# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Farkle — a press-your-luck dice game in a dark terminal/console aesthetic. **Pure HTML/CSS/JS with no build step, no dependencies, no `package.json`, no module bundler.** All scripts are classic (non-module) ES5-style IIFEs so the game runs directly from `file://`. The only backend is an optional PHP leaderboard.

## Running & testing

- **Run the game:** open `index.html` directly in a browser (double-click / drag in). No server, no `npm`.
- **Run the scoring self-test:** open `index.html?test=1`. `js/tests.js` runs a flat list of `check()` assertions against `scoring.js`; the summary appears in the in-game log and failures are printed to the browser console. There is no per-test runner — to isolate a case, edit the `check(...)` list in `js/tests.js`.
- **Run with the service worker / install as PWA:** the SW only registers over `http(s)`, so serve statically and open via `http://localhost`: `npx serve` or `python -m http.server`.
- **Leaderboard requires PHP:** PHP 7/8 with a writable `data/` directory. Offline / `file://` the leaderboard is simply unavailable — the game still works and names persist locally.
- **No build / lint commands exist.** Don't look for `npm run …`.
- **Headless logic testing:** `scoring.js`, `ai.js`, and `game.js` are DOM-free and attach to `window.Farkle`. You can load them in Node with a shim (`global.window = { Farkle: {} }; require('./js/scoring.js'); …` in dependency order) to exercise scoring, AI, and game-state logic without a browser.

## Architecture

Every file is an IIFE that reads from and writes to the single global `window.Farkle` namespace. **Dependencies are captured at load time** (e.g. `ai.js` does `var scoring = window.Farkle.scoring;` when its IIFE executes), so the `<script>` order in `index.html` is load-bearing:

```
scoring → sound → store → i18n → net → ai → game → ui → tests → main
```

Strict layering — respect it when adding code:

- **`scoring.js`** — pure functions only (score a dice set, `hasAnyScore`, `bestKeep`, Farkle odds). No state, no DOM.
- **`game.js`** — the `Game` class: all game state + the turn state machine. **No DOM.** Methods (`rollFresh`, `commitAndReroll`, `commitAndBank`, `bustTurn`, `nextTurn`, …) mutate state and return plain result objects; they never touch the UI. The controller interprets the results.
- **`ai.js`** — opponent heuristics (`chooseKeep`, `shouldBank`) with easy/normal/hard profiles. No DOM, no state.
- **`ui.js`** — owns **all** DOM: rendering, dice, input/keyboard, modals, themes, the log console. All user-facing text is resolved here via `i18n`.
- **`store.js`** — all `localStorage` access (settings, stats, the saved game, and the random `clientId`). Read/write is wrapped in try/catch so private-mode failures degrade silently.
- **`i18n.js`** — `uk`/`en` dictionary and `t(key, params)`.
- **`net.js`** — AJAX to the PHP leaderboard. Every call is `cb(err, data)`; failure is normal (offline) and never throws.
- **`main.js`** — **the controller and the only file that knows about every layer.** It wires `game + ai + ui + sound + store + net + i18n` together, drives turn flow, runs the AI turn, records stats, and talks to the leaderboard.

### Cross-cutting invariants

- **No DOM and no hardcoded strings in `scoring.js` / `game.js` / `ai.js`.** Keep game logic headless and testable.
- **All user-facing text goes through `i18n`.** When you add any visible string, add the key to **both** `uk` and `en` in `js/i18n.js` — never inline literals in `ui.js`/`main.js`. Static markup uses `data-i18n` / `data-i18n-html` / `data-i18n-ph` attributes, applied by `ui.applyI18n()`.

### Controller turn flow (`main.js`)

The async model is plain `setTimeout` wrapped in `delay(ms, fn)`, with every id tracked in `timers[]` and cancelled by `clearTimers()` (on menu / game-over / new game). An AI turn is `beginTurn → aiRoll → aiDecide` (looping reroll/bank) with delays between visible steps. A `locked` flag blocks human input during AI turns and roll animations. UI actions are routed through `data-action` attributes → `ui.onAction` → handler callbacks registered in `main.boot`.

### Saved-game / "Continue" feature

State persistence is split across layers and has subtle correctness rules:

- `game.serialize()` snapshots the full game; `Game.fromState(obj)` rebuilds it (with validation, returns `null` on garbage). `store.saveGame/loadGame/clearGame/hasGame` persist it under `farkle.savedGame`.
- `main.persist()` is called **only at stable, input-wait checkpoints** (turn start, after a human roll/reroll animation completes, after toggle/auto-select). It is deliberately **not** called during AI timer steps, banking, or Farkle pauses.
- `main.persistIfSafe()` (used on `beforeunload` and when leaving to the menu) skips when the game is over, when it's the AI's turn, or during a `settling` transition. Consequence: an AI turn always resumes from its **clean start** (scores as they were before the AI moved), so resuming never double-credits. The `settling` flag guards the post-bank / Farkle window between an action finishing and the next turn beginning.
- `continueGame()` restores and calls `runTurn()` (the body of `beginTurn` without bumping the turn counter). It resets the turn for AI restores, and resets a "stuck Farkle" human roll so the player can re-roll.

### Leaderboard backend

`api/leaderboard.php` + `data/leaderboard.json`, file-locked, no database. Actions: `list` (GET), `register` / `submit` (POST). Name uniqueness without auth: each browser generates a random `clientId` that "owns" a name; only the owner can update its stats. Cumulative stats are stored as running maxima (solo turns as a minimum). The service worker (`sw.js`) must never cache `/api/` or `/data/` — keep those network-only.

## Release / cache-busting convention (important)

There is a manual cache-busting scheme. **After editing any file under `js/` or `css/`:**

1. Bump `?v=N` on **every** `<script>` and `<link>` tag in `index.html` (they share one number).
2. Bump `VERSION` in `sw.js` to the **same** number (it changes the cache name and the cached asset URLs).
3. Bump `APP_VERSION` in `js/main.js` (shown in the menu footer) for user-visible releases.

The `?v=` query and `sw.js` `VERSION` must stay in sync or clients get a mix of stale and fresh files.
