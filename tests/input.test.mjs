// The pointer and the keys: only the widget on top takes a click, the keys
// are read once per frame, and nothing sticks when the page loses focus.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent } from '../src/data/content.js';
import { makeGame } from '../src/state/gameState.js';
import { makeInput, attach, endFrame } from '../src/systems/input.js';
import { frameKeys } from '../src/systems/hotkeys.js';
import { makeUiState } from '../src/ui/kit.js';
import { makeWindows, openWindow, findWindow } from '../src/state/windows.js';
import { drawPlay, desktop } from '../src/render/play.js';
import { startMenuRect } from '../src/render/startMenu.js';
import { theme, setDark, isDark } from '../src/core/theme.js';
import { makeBoot } from '../src/render/boot.js';
import { stubCtx } from './stubCanvas.mjs';

await initContent();
const W = 1600;
const H = 900;

function playState() {
  return {
    view: { w: W, h: H }, wallpaper: null, input: makeInput(), ui: makeUiState(),
    windows: makeWindows(), game: makeGame('INPUT', 7), win: {}, mode: 'play', time: 0,
  };
}

function press(state, x, y) {
  Object.assign(state.input, { inside: true, mouse: { x, y }, pressed: true, down: true });
  const events = [];
  drawPlay(stubCtx(), theme(), W, H, state, events);
  return events;
}

test('a click on the front window does not reach the window behind it', () => {
  const state = playState();
  const back = openWindow(state.windows, 'mail', desktop(W, H));
  const front = openWindow(state.windows, 'contracts', desktop(W, H));
  Object.assign(back, { x: 100, y: 100, w: 600, h: 400 });
  Object.assign(front, { x: 400, y: 80, w: 600, h: 400 });
  const backZ = back.z;
  // the back window's close button sits under the front window
  const events = press(state, 100 + 600 - 6 - 21 + 10, 100 + 3 + 10);
  assert.ok(!events.some((e) => e.id === 'win.close.mail'), 'the hidden close button did not fire');
  assert.equal(back.z, backZ, 'the back window was not raised');
  assert.ok(front.z > back.z, 'the front window stays on top');
  assert.ok(!state.windows.drag || state.windows.drag.key !== 'mail', 'the back window is not dragged');
});

test('a click on the open Start menu does not reach the window under it', () => {
  const state = playState();
  const win = openWindow(state.windows, 'mail', desktop(W, H));
  const menu = startMenuRect({ x: 0, y: 0, w: W, h: H });
  Object.assign(win, { x: 20, y: menu.y, w: 600, h: 300 });
  const z = win.z;
  state.startOpen = true;
  press(state, menu.x + 150, menu.y + 40);
  assert.equal(findWindow(state.windows, 'mail').z, z, 'the window under the menu was not raised');
  assert.equal(state.windows.drag, null);
});

test('the skin key is read once per frame, not once per step', () => {
  const state = playState();
  setDark(false);
  state.input.text = 'd';
  frameKeys(state);
  assert.equal(isDark(), true);
  assert.equal(state.game.settings.darkSkin, true, 'the run remembers the skin');
  endFrame(state.input);
  frameKeys(state);
  assert.equal(isDark(), true, 'a frame without the key changes nothing');
  setDark(false);
});

test('typing into a field does not flip the skin', () => {
  const state = playState();
  setDark(false);
  state.ui.focus = 'login.handle';
  state.input.text = 'd';
  frameKeys(state);
  assert.equal(isDark(), false);
});

test('a click outside a field lets go of the typing focus', () => {
  const state = playState();
  state.ui.focus = 'note.body';
  state.input.pressed = true;
  frameKeys(state);
  assert.equal(state.ui.focus, null, 'the field under the pointer takes it back while drawing');
});

test('a click skips the boot even on a frame that runs no step', () => {
  const state = { ...playState(), mode: 'boot', boot: makeBoot() };
  state.input.pressed = true;
  frameKeys(state);
  assert.equal(state.boot.done, true);
});

test('losing focus or a cancelled pointer lets go of everything', () => {
  const input = makeInput();
  const canvas = Object.assign(new EventTarget(), { getBoundingClientRect: () => ({ left: 0, top: 0 }) });
  const win = new EventTarget();
  attach(canvas, input, win);
  const ev = (type, props = {}) => Object.assign(new Event(type, { cancelable: true }), props);
  canvas.dispatchEvent(ev('pointerdown', { clientX: 5, clientY: 5, button: 0, pointerId: 1 }));
  canvas.dispatchEvent(ev('pointercancel'));
  assert.equal(input.down, false, 'pointercancel releases the button');
  canvas.dispatchEvent(ev('pointerdown', { clientX: 5, clientY: 5, button: 0, pointerId: 1 }));
  win.dispatchEvent(ev('keydown', { key: 'Shift', shiftKey: true }));
  win.dispatchEvent(ev('blur'));
  assert.equal(input.down, false, 'blur releases the button');
  assert.equal(input.shift, false, 'blur releases shift');
  const tab = ev('keydown', { key: 'Tab' });
  win.dispatchEvent(tab);
  assert.ok(tab.defaultPrevented, 'Tab stays in the game');
  win.dispatchEvent(ev('paste', { clipboardData: { getData: () => 'pasted' } }));
  assert.equal(input.paste, 'pasted', 'paste reaches the game');
});
