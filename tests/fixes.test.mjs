// Notepad takes typing, a contract can be picked from its list, and the
// scanlines setting is gone.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent } from '../src/data/content.js';
import { makeGame } from '../src/state/gameState.js';
import { makeInput, endFrame } from '../src/systems/input.js';
import { frameKeys } from '../src/systems/hotkeys.js';
import { makeUiState } from '../src/ui/kit.js';
import { makeWindows, openWindow, windowDef } from '../src/state/windows.js';
import { drawPlay, desktop } from '../src/render/play.js';
import { handleEvents } from '../src/systems/events.js';
import { theme, isDark, setDark } from '../src/core/theme.js';
import { stubCtx } from './stubCanvas.mjs';

await initContent();
const W = 1600;
const H = 900;
const DESK = desktop(W, H);

function playState() {
  return {
    view: { w: W, h: H }, wallpaper: null, input: makeInput(), ui: makeUiState(),
    windows: makeWindows(), game: makeGame('FIX', 7), win: {}, mode: 'play', time: 0,
  };
}

/// One drawn frame, in the order the game runs it.
function frame(state) {
  frameKeys(state);
  const events = [];
  const ctx = stubCtx();
  drawPlay(ctx, theme(), W, H, state, events);
  handleEvents(state, events, DESK);
  endFrame(state.input);
  return ctx;
}

/// Keys as the keyboard leaves them for one frame: \n is Enter, \b Backspace.
function keys(state, s) {
  for (const ch of s) {
    if (ch === '\n') state.input.enter = true;
    else if (ch === '\b') state.input.backspace = true;
    else state.input.text += ch;
    state.input.typed += ch;
  }
}

// -- notepad ------------------------------------------------------------------

test('the notepad is called Notepad', () => {
  assert.equal(windowDef('notepad').title, 'Notepad');
});

test('a click on the page lets the operator type into the notes', () => {
  const state = playState();
  const win = openWindow(state.windows, 'notepad', DESK);
  frame(state);
  Object.assign(state.input, { inside: true, mouse: { x: win.x + win.w / 2, y: win.y + win.h / 2 }, pressed: true, down: true });
  frame(state);
  Object.assign(state.input, { pressed: false, released: true, down: false });
  frame(state);
  keys(state, 'route via paris');
  frame(state);
  assert.equal(state.game.notes, 'route via paris');
  keys(state, '\n');
  frame(state);
  keys(state, 'pw 0451');
  frame(state);
  assert.equal(state.game.notes, 'route via paris\npw 0451');
  keys(state, '\b');
  frame(state);
  assert.equal(state.game.notes, 'route via paris\npw 045');
  state.input.paste = '1';
  frame(state);
  assert.equal(state.game.notes, 'route via paris\npw 0451');
  const ctx = frame(state);
  assert.ok(ctx.texts.some((t) => t.s === 'pw 0451'), 'the second line is drawn');
});

test('typing D into the notes does not swap the skin', () => {
  const state = playState();
  const win = openWindow(state.windows, 'notepad', DESK);
  Object.assign(state.input, { inside: true, mouse: { x: win.x + win.w / 2, y: win.y + win.h / 2 }, pressed: true, down: true });
  frame(state);
  Object.assign(state.input, { pressed: false, down: false });
  const before = isDark();
  keys(state, 'd');
  frame(state);
  assert.equal(isDark(), before);
  assert.equal(state.game.notes, 'd');
  setDark(false);
});

test('the notes take no typing until the page is clicked', () => {
  const state = playState();
  openWindow(state.windows, 'notepad', DESK);
  frame(state);
  keys(state, 'x');
  frame(state);
  assert.equal(state.game.notes, '');
});

// -- contracts ----------------------------------------------------------------

test('picking another contract in the list shows it', () => {
  const state = playState();
  openWindow(state.windows, 'contracts', DESK);
  frame(state);
  const offered = state.game.contracts
    .filter((c) => c.state === 'offered')
    .sort((a, b) => a.deadline - b.deadline);
  assert.ok(offered.length > 1, 'the run starts with more than one offer');
  assert.doesNotThrow(() => handleEvents(state, [{ type: 'select', id: 'ct.list.0', index: 1 }], DESK));
  assert.equal(state.win.contracts.ctSel, offered[1].id);
});

test('a tab that does not hold the picked contract picks its own first one', () => {
  const state = playState();
  openWindow(state.windows, 'contracts', DESK);
  frame(state);
  const first = state.game.contracts.find((c) => c.state === 'offered');
  state.win.contracts.ctSel = first.id;
  handleEvents(state, [{ type: 'click', id: `ct.accept.${first.id}` }], DESK);
  assert.equal(first.state, 'accepted', 'the job was taken');
  handleEvents(state, [{ type: 'click', id: 'ct.tab.0' }], DESK);
  frame(state);
  const shown = state.win.contracts.ctSel;
  assert.equal(state.game.contracts.find((c) => c.id === shown)?.state, 'offered', 'the offered tab shows an offer');
});

// -- system -------------------------------------------------------------------

test('there is no scanlines setting', () => {
  const state = playState();
  assert.ok(!('scanlines' in state.game.settings));
  openWindow(state.windows, 'settings', DESK);
  const ctx = frame(state);
  assert.ok(!ctx.texts.some((t) => /scanline/i.test(t.s)), 'SYSTEM does not offer it');
});

// -- the remote session --------------------------------------------------------

test('CRACK, COPY and BURN start their tasks on a live link', async () => {
  const { connect } = await import('../src/systems/sessionTick.js');
  const state = playState();
  const g = state.game;
  const job = g.contracts.find((c) => c.state === 'offered');
  assert.equal(connect(g, job.target), null);
  g.session.phase = 'online';
  const host = g.world.hosts[job.target];
  const locked = host.services.findIndex((s) => !s.open);
  assert.ok(locked >= 0, 'the target has a locked service');
  assert.doesNotThrow(() => handleEvents(state, [{ type: 'click', id: `sess.crack.${locked}` }], DESK));
  const after = g.session.tasks.length + g.toasts.length;
  assert.ok(after > 0, 'the crack either runs or says why it cannot');
  assert.doesNotThrow(() => handleEvents(state, [{ type: 'click', id: 'sess.copy.0' }], DESK));
  assert.doesNotThrow(() => handleEvents(state, [{ type: 'click', id: 'sess.del.0' }], DESK));
});

test('keys that land in one frame reach the notes in the order they were pressed', async () => {
  const { attachKeys } = await import('../src/systems/keyboard.js');
  const listeners = {};
  const win = { addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn); }, document: null };
  const state = playState();
  attachKeys(win, state.input);
  const press = (key) => listeners.keydown.forEach((fn) => fn({ key, preventDefault() {}, ctrlKey: false, metaKey: false, shiftKey: false }));
  const note = openWindow(state.windows, 'notepad', DESK);
  Object.assign(state.input, { inside: true, mouse: { x: note.x + note.w / 2, y: note.y + note.h / 2 }, pressed: true, down: true });
  frame(state);
  Object.assign(state.input, { pressed: false, down: false });
  // all of these between two frames
  for (const k of ['m', 'a', 'i', 'l', 'Enter', 'r', 'x', 'Backspace', 'o']) press(k);
  frame(state);
  assert.equal(state.game.notes, 'mail\nro');
});

test('the notepad counts the text it shows', () => {
  const state = playState();
  const note = openWindow(state.windows, 'notepad', DESK);
  Object.assign(state.input, { inside: true, mouse: { x: note.x + note.w / 2, y: note.y + note.h / 2 }, pressed: true, down: true });
  frame(state);
  Object.assign(state.input, { pressed: false, down: false });
  keys(state, 'ab\ncd');
  const ctx = frame(state);
  assert.ok(ctx.texts.some((t) => t.s.startsWith('2 lines // 5 chars')), 'the count is this frame\'s');
});

// -- readability ---------------------------------------------------------------

test('no window sets its words in the faint muted colour, in either skin', async () => {
  const { WINDOWS } = await import('../src/state/windows.js');
  const { color } = await import('../src/core/theme.js');
  for (const dark of [false, true]) {
    setDark(dark);
    const faint = color(theme().muted);
    for (const def of WINDOWS) {
      const state = playState();
      openWindow(state.windows, def.key, DESK);
      const ctx = frame(state);
      const bad = ctx.texts.filter((t) => t.style === faint && t.s.trim());
      assert.deepEqual(bad.map((t) => t.s), [], `${def.title} in the ${dark ? 'dark' : 'light'} skin`);
    }
  }
  setDark(false);
});

test('GATEWAY shows every machine number without a scroll', () => {
  const state = playState();
  openWindow(state.windows, 'gateway', DESK);
  const ctx = frame(state);
  const at = (s) => ctx.texts.find((t) => t.s === s);
  const last = at('PUBLIC IP');
  const parts = ctx.texts.find((t) => t.s.startsWith('FITTED PARTS'));
  assert.ok(last && parts, 'both are drawn');
  assert.ok(last.y + 20 <= parts.y, 'the last number sits above the fitted parts');
  assert.ok(ctx.texts.some((t) => / of \d+ slots$/.test(t.s)), 'a fitted part names the slots it fills');
});

test('the map route panel holds its buttons without a scroll', () => {
  const state = playState();
  openWindow(state.windows, 'map', DESK);
  const ctx = frame(state);
  const save = ctx.texts.find((t) => t.s === 'SAVE ROUTE');
  const kept = ctx.texts.find((t) => /^SAVED ROUTE/.test(t.s));
  assert.ok(save && kept, 'both are drawn');
  assert.ok(save.y + 20 <= kept.y, 'SAVE ROUTE sits above the kept routes');
});

test('a mail subject runs the width of its row', () => {
  const state = playState();
  openWindow(state.windows, 'mail', DESK);
  const ctx = frame(state);
  const subjects = state.game.mail.map((m) => m.subject);
  const drawn = ctx.texts.filter((t) => subjects.includes(t.s));
  assert.ok(drawn.length >= Math.min(subjects.length, 3), 'the subjects are drawn whole, not cut short');
});
