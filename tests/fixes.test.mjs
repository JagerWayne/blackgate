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

test('MY JOBS holds the work in hand, and DROP asks twice', () => {
  const state = playState();
  const first = state.game.contracts.find((c) => c.state === 'offered');
  handleEvents(state, [{ type: 'click', id: `dsn.accept.${first.id}` }], DESK);
  assert.equal(first.state, 'accepted', 'the job was taken');
  handleEvents(state, [{ type: 'click', id: 'hdr.contracts' }], DESK);
  assert.equal(state.win.dsn.tabs[state.win.dsn.active].url, 'jobs', 'the header opens MY JOBS');
  handleEvents(state, [{ type: 'click', id: `dsn.drop.${first.id}` }], DESK);
  assert.equal(first.state, 'accepted', 'one press only arms DROP');
  handleEvents(state, [{ type: 'click', id: `dsn.drop.${first.id}` }], DESK);
  assert.notEqual(first.state, 'accepted', 'the second press drops it');
});

// -- system -------------------------------------------------------------------

test('the scanlines live under one working effects switch', () => {
  const state = playState();
  // the old scanlines setting did nothing; the effects switch drives drawFx
  assert.ok(!('scanlines' in state.game.settings));
  assert.equal(state.game.settings.effects, true);
  openWindow(state.windows, 'settings', DESK);
  handleEvents(state, [{ type: 'toggle', id: 'set.fx', value: false }], DESK);
  assert.equal(state.game.settings.effects, false);
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

test('the map: the tabs switch, and every hop and route button does its job', () => {
  const state = playState();
  const g = state.game;
  openWindow(state.windows, 'map', DESK);
  const click = (id) => handleEvents(state, [{ type: 'click', id }], DESK);
  const found = g.world.hosts.filter((h) => h.discovered).slice(0, 3).map((h) => h.id);
  assert.equal(found.length, 3, 'three known hosts');
  g.player.bounce.length = 0;
  g.routes = [];

  click('map.tab.ROUTE');
  assert.equal(state.win.map.tab, 'ROUTE');
  assert.ok(frame(state).texts.some((t) => t.s === 'SAVE ROUTE'), 'the ROUTE tab shows its buttons');

  click(`map.hop.${found[0]}`);
  click(`map.hop.${found[1]}`);
  state.win.map.sel = found[2];
  click('map.addsel');
  assert.deepEqual(g.player.bounce, found, '+HOP and ADD PICKED add in order');
  click('map.addsel');
  assert.equal(g.player.bounce.length, 3, 'adding the same host twice does nothing');

  click('map.down.0');
  assert.deepEqual(g.player.bounce, [found[1], found[0], found[2]]);
  click('map.up.2');
  assert.deepEqual(g.player.bounce, [found[1], found[2], found[0]]);
  click('map.up.0');
  assert.deepEqual(g.player.bounce, [found[1], found[2], found[0]], 'the first hop cannot go up');

  click(`map.show.${found[0]}`);
  assert.equal(state.win.map.sel, found[0]);
  assert.equal(state.win.map.tab, 'HOSTS', 'SHOW brings up the host in the list too');
  click('map.tab.ROUTE');
  assert.ok(frame(state).texts.some((t) => t.s === 'REMOVE'), 'each hop has its buttons');

  click('map.route.save');
  assert.equal(g.routes.length, 1);
  click(`map.hop.${found[2]}`);
  assert.deepEqual(g.player.bounce, [found[1], found[0]], 'REMOVE takes the hop out');
  click('map.route.clear');
  assert.equal(g.player.bounce.length, 0);

  click('map.tab.SAVED');
  assert.ok(frame(state).texts.some((t) => t.s === 'USE'));
  click('map.route.load.0');
  assert.deepEqual(g.player.bounce, [found[1], found[2], found[0]], 'USE brings the route back');
  click('map.route.del.0');
  assert.equal(g.routes.length, 0);

  click('map.tab.HOSTS');
  assert.ok(frame(state).texts.some((t) => t.s === '-HOP'), 'hosts on the route say -HOP');
  click(`map.fav.${found[0]}`);
  assert.ok(g.favorites.includes(found[0]));
});

test('a mail subject runs the width of its row', () => {
  const state = playState();
  openWindow(state.windows, 'mail', DESK);
  const ctx = frame(state);
  const subjects = state.game.mail.map((m) => m.subject);
  const drawn = ctx.texts.filter((t) => subjects.includes(t.s));
  assert.ok(drawn.length >= Math.min(subjects.length, 3), 'the subjects are drawn whole, not cut short');
});
