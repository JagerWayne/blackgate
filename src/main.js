// The bootstrap: owns the canvas, loads the content folder, runs the screens.

import { runPending } from './windows/terminal.js';
import { startLoop } from './core/loop.js';
import { initContent } from './data/content.js';
import { makeInput, attach, endFrame } from './systems/input.js';
import { theme } from './core/theme.js';
import { frameKeys } from './systems/hotkeys.js';
import { makeBoot, tickBoot, drawBoot } from './render/boot.js';
import { drawOff } from './render/off.js';
import { makeSetup, tickSetup, drawSetup } from './render/setup.js';
import { makeLogin, drawLogin } from './render/login.js';
import { makeUiState } from './ui/kit.js';
import { tick } from './systems/tick.js';
import { makeWindows } from './state/windows.js';
import { drawPlay, desktop } from './render/play.js';
import { handleEvents } from './systems/events.js';
import { saveRun, listSlots, saveOnLeave, deleteRun, profilesFull, MAX_PROFILES } from './state/save.js';
import { startRun } from './state/startRun.js';
import { toast } from './state/gameState.js';
import { VERSION, justUpdated } from './version.js';
import { drawFx } from './render/fx.js';

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d', { alpha: false });
const view = { w: 1920, h: 1080 };

function fit() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(window.innerWidth, 320);
  const h = Math.max(window.innerHeight, 240);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  view.w = w;
  view.h = h;
}

fit();
window.addEventListener('resize', fit);

const content = await initContent();
const wallpaper = await new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = './src/player/wallpaper/default.jpg';
});

const state = {
  content,
  view,
  wallpaper,
  input: makeInput(),
  ui: makeUiState(),
  boot: makeBoot(),
  login: makeLogin(),
  windows: makeWindows(),
  game: null,
  win: {},
  mode: 'boot',
  time: 0,
};

attach(canvas, state.input);
saveOnLeave(window, state);
canvas.focus?.();

state.login.slots = listSlots();
// the first start after an update says so on the welcome screen
const was = justUpdated();
if (was) state.login.notice = `Updated to v${VERSION} (was v${was})`;
let autosaveT = 0;
let saveWarned = false;

/// The saved operators on this terminal, read fresh for the welcome screen.
function refreshSlots() {
  state.login.slots = listSlots();
  // a saved run is picked first, so Enter never starts over it by accident
  state.login.sel = state.login.slots.length ? 1 : 0;
}

function step(dt) {
  state.time += dt;
  if (state.mode === 'boot' && tickBoot(state.boot, dt, state.input)) {
    state.mode = 'login';
    refreshSlots();
  }
  if (state.mode === 'setup' && tickSetup(state.setup, dt, state.input)) {
    saveRun(state.game);
    state.setup = null;
    state.mode = 'play';
    state.ui.focus = null;
  }
  if (state.mode === 'play') {
    tick(state.game, dt);
    // an ended run is never saved over the last good one
    if (state.game.settings.autosave && !state.game.gameOver) {
      autosaveT += dt;
      if (autosaveT > 45) {
        autosaveT = 0;
        // warn once per run of failures, not every 45 seconds
        const ok = saveRun(state.game);
        if (!ok && !saveWarned) toast(state.game, 'Save failed // browser storage is full or blocked', 'bad');
        saveWarned = !ok;
      }
    }
  }
}

function render() {
  const sk = theme();
  const { w, h } = state.view;
  if (state.mode === 'boot') {
    drawBoot(ctx, state.boot, w, h, sk);
    return;
  }
  if (state.mode === 'off') {
    drawOff(ctx, w, h);
    return;
  }
  if (state.mode === 'setup') {
    drawSetup(ctx, state.setup, sk, w, h);
    return;
  }
  if (state.mode === 'login') {
    const events = [];
    drawLogin(ctx, state.login, sk, w, h, state.input, state.ui, events);
    events.forEach((e) => {
      if (e.type === 'click' && e.id === 'login.go') {
        const fresh = state.login.sel === 0;
        // four profiles at most: a new handle needs a free one
        if (fresh && profilesFull(state.login.slots, state.login.handle)) {
          state.login.notice = `${MAX_PROFILES} profiles in use // delete one to make a new profile`;
          return;
        }
        state.game = startRun(state, w, h);
        // a new operator watches their world being made, then gets their save file
        if (fresh) {
          state.setup = makeSetup(state.game);
          state.mode = 'setup';
          return;
        }
        // Electron only: data files in Documents that were missing or broken
        (globalThis.blackgate?.dataFallbacks() ?? []).forEach((f) =>
          toast(state.game, `${f} unreadable // using the built-in copy`, 'bad'),
        );
        state.mode = 'play';
        state.ui.focus = null;
      } else if (e.type === 'click' && e.id === 'login.off') {
        state.mode = 'off';
      } else if (e.type === 'click' && e.id === 'login.delete') {
        // the button asks twice: the first press arms it, the second throws
        // the save away
        if (state.login.confirmDelete) {
          const gone = deleteRun(state.login.slots[state.login.sel - 1]?.handle);
          refreshSlots();
          state.login.confirmDelete = false;
          state.login.notice = gone ? 'saved run deleted' : 'the save could not be deleted';
        } else {
          state.login.confirmDelete = true;
        }
      }
    });
    return;
  }
  const events = [];
  drawPlay(ctx, sk, w, h, state, events);
  drawFx(ctx, w, h, state, Math.min(state.time - (state.fxAt ?? state.time), 0.1));
  state.fxAt = state.time;
  handleEvents(state, events, desktop(w, h));
  // the command prompt's lines run once the frame's clicks are in
  runPending(state, desktop(w, h));
}

// the shell's own keys are read once per drawn frame, before the screen
startLoop({ step, render: () => { frameKeys(state); render(); endFrame(state.input); } });
