// How a run ends: a completed trace seizes the link and ends the run, the
// ending is shown over the shell, and its buttons start again or load the
// last save. Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent } from '../src/data/content.js';
import { makeGame } from '../src/state/gameState.js';
import { connect, sessionTick } from '../src/systems/sessionTick.js';
import { makeInput, endFrame } from '../src/systems/input.js';
import { makeUiState } from '../src/ui/kit.js';
import { makeWindows, openWindow } from '../src/state/windows.js';
import { drawPlay, desktop } from '../src/render/play.js';
import { handleEvents } from '../src/systems/events.js';
import { saveRun } from '../src/state/save.js';
import { theme } from '../src/core/theme.js';
import { stubCtx } from './stubCanvas.mjs';

await initContent();

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const W = 1600;
const H = 900;

function playState(game) {
  const state = {
    view: { w: W, h: H }, wallpaper: null, input: makeInput(), ui: makeUiState(),
    windows: makeWindows(), game, win: {}, mode: 'play', time: 0,
    login: { handle: '', seed: '', sel: 0, slots: [], error: '', scale: 1 },
  };
  openWindow(state.windows, 'mail', desktop(W, H));
  return state;
}

/// Runs one frame of the play screen and returns what it drew and did.
function frame(state, ctx) {
  const events = [];
  drawPlay(ctx, theme(), W, H, state, events);
  handleEvents(state, events, desktop(W, H));
  endFrame(state.input);
  return events;
}

/// Clicks the button whose caption is `text`: press, then release.
function clickText(state, text) {
  const ctx = stubCtx();
  frame(state, ctx);
  const at = ctx.texts.find((t) => t.s === text);
  assert.ok(at, `"${text}" is on screen`);
  Object.assign(state.input, { inside: true, mouse: { x: at.x, y: at.y + 2 }, pressed: true, down: true });
  frame(state, stubCtx());
  Object.assign(state.input, { released: true, down: false });
  return frame(state, stubCtx());
}

test('a completed trace seizes the link and ends the run', () => {
  const g = makeGame('TRACED', 7);
  connect(g, g.contracts[0].target);
  for (let i = 0; i < 600 && g.session.phase !== 'online'; i += 1) sessionTick(g, 1 / 60);
  Object.assign(g.session, { alerted: true, trace: 0.999 });
  for (let i = 0; i < 600 && g.session; i += 1) sessionTick(g, 1 / 60);
  assert.equal(g.session, null, 'the link is closed');
  assert.equal(g.gameOver, 'caught');
  assert.ok(g.log.some((l) => l.text.includes('TRACE COMPLETE')), 'the log says why');
});

test('the ending is shown over the shell and the windows stop taking clicks', () => {
  for (const [ending, title] of [['caught', 'TRACE COMPLETE'], ['raided', 'DOOR KICKED IN']]) {
    const state = playState(makeGame('OVER', 7));
    state.game.gameOver = ending;
    const ctx = stubCtx();
    frame(state, ctx);
    const drawn = ctx.texts.map((t) => t.s);
    for (const want of [title, 'NEW CAMPAIGN', 'LOAD LAST SAVE']) assert.ok(drawn.includes(want), `${ending}: ${want}`);
    const close = clickText(state, 'NEW CAMPAIGN');
    assert.ok(!close.some((e) => e.id?.startsWith('win.')), 'no window button fired under the ending');
  }
});

test('NEW CAMPAIGN goes back to the welcome screen with a clean desk', () => {
  const state = playState(makeGame('OVER', 7));
  state.game.gameOver = 'caught';
  clickText(state, 'NEW CAMPAIGN');
  assert.equal(state.mode, 'login');
  assert.equal(state.game, null);
  assert.equal(state.windows.list.length, 0);
});

test('LOAD LAST SAVE puts the saved run back in play', () => {
  saveRun(makeGame('SAVED', 9));
  const state = playState(makeGame('OVER', 7));
  state.game.gameOver = 'raided';
  clickText(state, 'LOAD LAST SAVE');
  assert.equal(state.mode, 'play');
  assert.equal(state.game.player.handle, 'SAVED');
  assert.equal(state.game.gameOver, null);
});
