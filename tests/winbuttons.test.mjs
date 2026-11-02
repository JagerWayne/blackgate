// The caption buttons and the taskbar: minimize tucks a window away, the
// taskbar brings it back, and maximize fills the desktop until pressed again.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent } from '../src/data/content.js';
import { makeGame } from '../src/state/gameState.js';
import { makeInput } from '../src/systems/input.js';
import { makeUiState } from '../src/ui/kit.js';
import { makeWindows, openWindow, findWindow, ordered, windowAt } from '../src/state/windows.js';
import { drawPlay, desktop } from '../src/render/play.js';
import { handleEvents } from '../src/systems/events.js';
import { theme } from '../src/core/theme.js';
import { stubCtx } from './stubCanvas.mjs';

await initContent();
const W = 1600;
const H = 900;
const DESK = desktop(W, H);

function playState() {
  const state = {
    view: { w: W, h: H }, wallpaper: null, input: makeInput(), ui: makeUiState(),
    windows: makeWindows(), game: makeGame('WIN', 7), win: {}, mode: 'play', time: 0,
  };
  openWindow(state.windows, 'mail', DESK);
  openWindow(state.windows, 'contracts', DESK);
  return state;
}
const click = (state, id) => handleEvents(state, [{ type: 'click', id }], DESK);
const shown = (state) => ordered(state.windows).map((w) => w.key);

test('minimize tucks a window away and the taskbar brings it back', () => {
  const state = playState();
  click(state, 'win.min.mail');
  assert.ok(findWindow(state.windows, 'mail'), 'still open');
  assert.ok(!shown(state).includes('mail'), 'not on the desktop');
  click(state, 'task.mail');
  assert.equal(shown(state).at(-1), 'mail', 'back, and in front');
});

test('the taskbar button of the front window minimizes it', () => {
  const state = playState();
  click(state, 'task.contracts');
  assert.ok(!shown(state).includes('contracts'));
});

test('maximize fills the desktop, and pressing it again restores the window', () => {
  const state = playState();
  const mail = findWindow(state.windows, 'mail');
  const before = { x: mail.x, y: mail.y, w: mail.w, h: mail.h };
  click(state, 'win.max.mail');
  click(state, 'task.mail');
  const ctx = stubCtx();
  drawPlay(ctx, theme(), W, H, state, []);
  const corner = windowAt(state.windows, DESK.x + DESK.w - 2, DESK.y + DESK.h - 2);
  assert.equal(corner, mail, 'the maximized window reaches the far corner');
  const caption = ctx.texts.find((t) => t.s === 'MAIL' && t.y < DESK.y + 26);
  assert.ok(caption && caption.x < DESK.x + 20, 'the caption is drawn at the top left of the desktop');
  // a drag on the caption, where the old and the full caption overlap, does
  // not move a maximized window
  Object.assign(state.input, { inside: true, mouse: { x: mail.x + 100, y: DESK.y + 20 }, pressed: true, down: true });
  drawPlay(stubCtx(), theme(), W, H, state, []);
  Object.assign(state.input, { mouse: { x: DESK.x + 400, y: DESK.y + 200 }, pressed: false });
  drawPlay(stubCtx(), theme(), W, H, state, []);
  click(state, 'win.max.mail');
  assert.deepEqual({ x: mail.x, y: mail.y, w: mail.w, h: mail.h }, before, 'restored to where it was');
});

test('picking a tool in SOFTWARE shows that tool in the detail pane', async () => {
  const { software } = await import('../src/data/content.js');
  const state = playState();
  openWindow(state.windows, 'software', DESK);
  drawPlay(stubCtx(), theme(), W, H, state, []);
  const tools = software();
  assert.ok(tools.length > 2, 'the shop has tools');
  handleEvents(state, [{ type: 'select', id: 'sw.list', index: 2 }], DESK);
  assert.equal(state.win.software.sel, tools[2].kind);
  const ctx = stubCtx();
  drawPlay(ctx, theme(), W, H, state, []);
  assert.ok(ctx.texts.some((t) => t.s === tools[2].name), 'its name is drawn');
});

test('the Bl@ckG@te window draws a live link without overlapping its log', async () => {
  const { connect } = await import('../src/systems/sessionTick.js');
  const state = playState();
  const g = state.game;
  assert.equal(connect(g, g.contracts[0].target), null, 'the link opens');
  g.session.phase = 'online';
  const win = openWindow(state.windows, 'blackgate', DESK);
  for (const tab of [0, 1, 2]) {
    state.win.blackgate = { tab };
    const ctx = stubCtx();
    drawPlay(ctx, theme(), W, H, state, []);
    assert.ok(ctx.texts.some((t) => t.s === 'DISCONNECT'), `tab ${tab}: the way out is drawn`);
    const log = ctx.texts.find((t) => t.s === 'LINK LOG');
    assert.ok(log, `tab ${tab}: the link log is drawn`);
    const below = ctx.texts.filter((t) => t.y > log.y - 2 && t.y < win.y + win.h && t.s !== 'LINK LOG' && t.x < win.x + win.w);
    assert.ok(below.every((t) => t.s !== 'DISCONNECT'), `tab ${tab}: nothing from the panes sits in the log`);
  }
});

test('every Start menu entry sits above the way out', async () => {
  const { startMenuRect } = await import('../src/render/startMenu.js');
  const { WINDOWS } = await import('../src/state/windows.js');
  const r = startMenuRect({ x: 0, y: 0, w: W, h: H });
  // the menu lists only the applications it carries: hidden ones open another way
  const lastRowBottom = r.y + 12 + 56 + WINDOWS.filter((w) => !w.hidden).length * 32 - 2;
  assert.ok(lastRowBottom <= r.y + r.h - 44, 'the last row ends before Turn off');
});
