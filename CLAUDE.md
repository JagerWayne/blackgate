# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

BLACKGATE is a network-intrusion sim set in a Windows-XP-style desktop: a DOM + Tailwind v4 UI built with Vite (no framework), wrapped in Electron for the Windows app. Everything lives in `v2/`. `README.md` still describes the game (gameplay, content tables, release flow); its UI sections describe the canvas build.

## Commands

```bash
npm install
npm run ui            # Vite dev server for v2 (runv2.bat does this and opens it)
npm run ui:build      # production build into v2/dist
npm start             # builds v2, then runs Electron on v2/dist
npm test              # node --test v2/tests/*.mjs   (npm run test:v2 is the same)
node --test v2/tests/economy.test.mjs                   # a single test file
npm run dist          # builds v2, packages it, writes dist/ (app zip, latest.json, launcher) without upload
npm run release       # same, then upload to GitHub release v<version> via gh
```

There is no linter. Releasing: raise `version` in `package.json` **and** `VERSION` in `v2/game/version.js` (`v2/tests/version.test.mjs` fails if they differ), commit, push, then `npm run release`.

## Layout

- `v2/app/` the DOM shell: `main.js` (the loop and `state.mode`: boot/login/setup/play/off), windows, header (the tray in the taskbar: credits, rating, heat, speed, pause, jobs, clock; and the BL@CKG@TE name that opens Debug), login, screens (boot/setup/off), spotlight (tutorial), keys, tooltips, fx (sound and effects), `apps/` one file per window.
- `v2/game/` the rules and world (`core`, `data`, `state`, `systems`): fixed-step tick, seeded RNG, content loading, world generation, saves. Never import `app/` or `pages/` from here.
- `v2/pages/` canvas-era page and window builders the DOM still reads (Internet XPlorer pages build controls, each custom block carrying a `dom` descriptor that `app/apps/dsn*.js` draws). This is debt to port away.
- `v2/data/` the JSON content and the images (see each `images/*/WHAT-TO-PUT-HERE.txt`); a missing image shows a grey rectangle. `game/data/contentLoad.js` reads the JSON relative to the page. Portraits are whatever is in `images/people/male` and `/female`: `vite.config.mjs` lists the folders itself, there is no index file.
- `v2/tools/` content scripts (`socialmedia.mjs` via `images/socialmedia/populate.bat`, `countries.mjs`, `economy.mjs`).
- `electron/` the Windows shell. `main.js` serves `v2/dist` over a private `app://blackgate/` scheme and answers content JSON from the player's copy in `Documents\Games\Blackgate` first, then the built-in copy. `preload.js` is the save bridge (atomic writes, names never paths; context isolation on, Node off). `files.js` has no Electron imports so tests can load it. `release.js`, `launcher.nsi` and `launcher.ps1` build and implement the self-updating `blackgate.exe` launcher.

## How the UI talks to the game

- Buttons send canvas-style ids through `handleEvents` (`app/ui.js` `click`, `edit`, `toggle`, `select`), so the game's own rules and refusals apply.
- State stays in `state.win.<key>` because the tutorial reads it; the window manager (`state.windows`) is the single source of truth and `app/windows.js` mirrors it into the DOM every frame.
- `autoRender(body, sig, render)` redraws an app only when its signature changes and keeps focus, caret and scroll.

## Things that bite

- **World generation is deterministic from the seed**, and tests assert it. Adding an `rng` draw anywhere in generation shifts every host, file and password generated after it and breaks seeded tests and existing players' worlds. Derive new per-person/host fields from existing values (index, name) instead of drawing, and backfill them on load for old saves.
- **Strings live in `v2/data/language/<code>.json`** (`en.json`; `index.json` lists the languages; the choice is `language` in `mainsettings.json`, picked on the Debug window's SETTINGS tab). Code asks for text with `tl('key', ...vars)` (`import { t as tl } from '.../game/data/language.js'`; `{0}`, `{1}` in the text). The file is read when the module loads, so a language change needs a reload; a missing key falls back to English, then to the key. New player-facing strings: add a key to `en.json` (or run `node v2/tools/i18n-extract.mjs`, which moves strings in `toast`/`fail`/`help`/`about`/button `text` positions); `osint.test.mjs` fails if a `tl('key')` has no entry or an entry is unused. Text inside big HTML templates is not moved automatically.
- Saves are versioned (`SAVE_VERSION` in `game/state/save.js`); old saves must load into a world matching a new world of the same seed.
- The main game numbers (profiles, companies, people, relays, starting cash, route, job, notepad, tab and bank limits) live in `v2/data/mainsettings.json`, read through `game/data/settings.js` (accessors such as `maxProfiles()`; a missing or out-of-range value falls back to the built-in default). Four profiles by default. World numbers only affect new worlds.
- Tests render windows onto `v2/tests/stubCanvas.mjs`, a recording fake 2D context (every glyph 7 px wide). Use `stubCtx()` for new UI tests of `pages/` code. The DOM apps themselves have no tests yet.
