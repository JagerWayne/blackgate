// Notepad: numbered lines, a wrap switch, and a page that scrolls both ways.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent } from '../src/data/content.js';
import { makeGame } from '../src/state/gameState.js';
import { makeInput, endFrame } from '../src/systems/input.js';
import { frameKeys } from '../src/systems/hotkeys.js';
import { makeUiState } from '../src/ui/kit.js';
import { makeWindows, openWindow } from '../src/state/windows.js';
import { drawPlay, desktop } from '../src/render/play.js';
import { handleEvents } from '../src/systems/events.js';
import { theme } from '../src/core/theme.js';
import { stubCtx } from './stubCanvas.mjs';

await initContent();
const W = 1600;
const H = 900;
const DESK = desktop(W, H);

function noteState(notes = '') {
  const state = {
    view: { w: W, h: H }, wallpaper: null, input: makeInput(), ui: makeUiState(),
    windows: makeWindows(), game: makeGame('NOTES', 7), win: {}, mode: 'play', time: 0,
  };
  state.game.notes = notes;
  openWindow(state.windows, 'notepad', DESK);
  frame(state);
  return state;
}
function frame(state) {
  frameKeys(state);
  const events = [];
  const ctx = stubCtx();
  drawPlay(ctx, theme(), W, H, state, events);
  handleEvents(state, events, DESK);
  endFrame(state.input);
  return ctx;
}
const page = (state) => state.win.notepad.page;
const pointer = (state, x, y, extra = {}) => Object.assign(state.input, { inside: true, mouse: { x, y }, ...extra });
const many = (n) => Array.from({ length: n }, (_, i) => `line ${i + 1}`).join('\n');
const LONG = 'x'.repeat(400);

// -- line numbers ---------------------------------------------------------------

test('every line is numbered in the gutter', () => {
  const state = noteState('alpha\nbeta\ngamma');
  const ctx = frame(state);
  const p = page(state);
  const nums = ctx.texts.filter((t) => ['1', '2', '3'].includes(t.s) && t.x < p.x + 60);
  assert.equal(nums.length, 3, 'one number a line');
  const alpha = ctx.texts.find((t) => t.s === 'alpha');
  assert.ok(alpha.x > Math.max(...nums.map((t) => t.x)), 'the text sits right of the numbers');
});

test('a wrapped line is numbered once', () => {
  const state = noteState(`short\n${LONG}`);
  const ctx = frame(state);
  const p = page(state);
  const nums = ctx.texts.filter((t) => /^\d+$/.test(t.s) && t.x < p.x + 60);
  assert.deepEqual(nums.map((t) => t.s), ['1', '2'], 'two lines, however many rows');
});

// -- wrap -----------------------------------------------------------------------

test('wrap is on to begin with, and the switch turns it off and on', () => {
  const state = noteState(LONG);
  assert.notEqual(state.game.settings.noteWrap, false, 'on by default');
  let ctx = frame(state);
  assert.ok(ctx.texts.some((t) => t.s === 'WRAP: ON'));
  const rowsOn = ctx.texts.filter((t) => /^x+$/.test(t.s)).length;
  assert.ok(rowsOn > 1, 'a long line breaks across rows');
  handleEvents(state, [{ type: 'click', id: 'note.wrap' }], DESK);
  assert.equal(state.game.settings.noteWrap, false, 'the setting is kept with the run');
  ctx = frame(state);
  assert.ok(ctx.texts.some((t) => t.s === 'WRAP: OFF'));
  assert.equal(ctx.texts.filter((t) => /^x+$/.test(t.s)).length, 1, 'off: the line stays one row');
  handleEvents(state, [{ type: 'click', id: 'note.wrap' }], DESK);
  assert.equal(state.game.settings.noteWrap, true);
});

// -- the vertical scrollbar ---------------------------------------------------------

test('the wheel scrolls a long page, and the top lines come back into view', () => {
  const state = noteState(many(80));
  let ctx = frame(state);
  assert.ok(!ctx.texts.some((t) => t.s === 'line 1'), 'a long page opens on its end');
  const p = page(state);
  pointer(state, p.x + p.w / 2, p.y + p.h / 2, { scroll: 4000 });
  frame(state);
  ctx = frame(state);
  assert.ok(ctx.texts.some((t) => t.s === 'line 1'), 'scrolled to the top');
  assert.equal(state.ui.scroll.get('note.v'), 0);
});

test('the vertical thumb drags', () => {
  const state = noteState(many(80));
  const p = page(state);
  const x = p.x + p.w - 4;
  // to the top of the track, then down to its foot
  pointer(state, x, p.y + 6, { pressed: true, down: true });
  frame(state);
  assert.equal(state.ui.scroll.get('note.v'), 0, 'a press high on the track goes to the top');
  pointer(state, x, p.y + p.h - 2, { pressed: false, down: true });
  frame(state);
  assert.ok(state.ui.scroll.get('note.v') > 0, 'the drag carries the page down');
  pointer(state, x, p.y + p.h - 2, { down: false, released: true });
  frame(state);
});

// -- the horizontal scrollbar -------------------------------------------------------

test('a wide line with wrap off gets a horizontal scrollbar', () => {
  const state = noteState(LONG);
  handleEvents(state, [{ type: 'click', id: 'note.wrap' }], DESK);
  frame(state);
  const p = page(state);
  assert.ok(state.win.notepad.maxH > 0, 'there is something to scroll across to');
  pointer(state, p.x + p.w / 2, p.y + p.h / 2, { scroll: 4000, shift: true });
  frame(state);
  assert.equal(state.ui.scroll.get('note.h'), 0, 'shift and the wheel scroll it back to the start');
  const x = p.x + p.w - 30;
  const y = p.y + p.h - 4;
  pointer(state, p.x + 70, y, { pressed: true, down: true, shift: false, scroll: 0 });
  frame(state);
  pointer(state, x, y, { pressed: false, down: true });
  frame(state);
  assert.ok(state.ui.scroll.get('note.h') > 0, 'the horizontal thumb drags');
  pointer(state, x, y, { down: false, released: true });
  frame(state);
});

test('with wrap on there is nothing to scroll across', () => {
  const state = noteState(LONG);
  frame(state);
  assert.equal(state.win.notepad.maxH, 0);
});

// -- typing follows the caret ----------------------------------------------------------

test('typing brings the caret back into view', () => {
  const state = noteState(many(80));
  const p = page(state);
  // click into the page, scroll to the top, then type
  pointer(state, p.x + p.w / 2, p.y + p.h / 2, { pressed: true, down: true });
  frame(state);
  pointer(state, p.x + p.w / 2, p.y + p.h / 2, { pressed: false, down: false, scroll: 4000 });
  frame(state);
  assert.equal(state.ui.scroll.get('note.v'), 0);
  state.input.scroll = 0;
  state.input.text = '!';
  state.input.typed = '!';
  const ctx = frame(state);
  assert.ok(ctx.texts.some((t) => t.s.endsWith('!')), 'the line typed into, at the clicked caret, is on screen');
  assert.ok(state.ui.scroll.get('note.v') > 0);
});

// -- what the review found ----------------------------------------------------------

test('wrapping keeps every character: indents, runs of spaces, a trailing space', async () => {
  const { wrapRow } = await import('../src/windows/notepad.js');
  const ctx = stubCtx();
  const lines = ['    - indented item', 'a   b    c', 'trailing ', '   ', `word ${'z'.repeat(300)} after`];
  for (const line of lines) {
    const rows = wrapRow(ctx, line, 200);
    assert.equal(rows.join(''), line, JSON.stringify(line));
  }
  const broken = wrapRow(ctx, `word ${'z'.repeat(300)} after`, 200);
  assert.ok(broken.length > 2, 'the long word is broken by characters');
  assert.ok(broken.at(-1).endsWith(' after'), 'the next word carries on after the broken one');
});

test('an indented line is drawn with its indent, wrap on or off', () => {
  const state = noteState('    - item');
  let ctx = frame(state);
  assert.ok(ctx.texts.some((t) => t.s === '    - item'), 'wrap on');
  handleEvents(state, [{ type: 'click', id: 'note.wrap' }], DESK);
  ctx = frame(state);
  assert.ok(ctx.texts.some((t) => t.s === '    - item'), 'wrap off');
});

test('rolling the wheel down moves down the page', () => {
  const state = noteState(many(80));
  const p = page(state);
  pointer(state, p.x + p.w / 2, p.y + p.h / 2, { scroll: 4000 });
  frame(state);
  assert.equal(state.ui.scroll.get('note.v'), 0, 'up to the top');
  // a real wheel notch down arrives as a positive deltaY
  state.input.scroll = -120;
  frame(state);
  assert.ok(state.ui.scroll.get('note.v') > 0, 'down from the top');
});

test('a wheel notch down is read as downward by the input', async () => {
  const { attach, makeInput: fresh } = await import('../src/systems/input.js');
  const on = {};
  const canvas = { addEventListener: (type, fn) => { on[type] = fn; }, getBoundingClientRect: () => ({ left: 0, top: 0, width: W, height: H }) };
  const input = fresh();
  attach(canvas, input, { addEventListener() {}, document: null });
  on.wheel({ deltaY: 120, preventDefault() {} });
  assert.ok(input.scroll < 0, 'down is negative: every scroller takes it off its offset');
});

test('grabbing the thumb does not jump the page', () => {
  const state = noteState(many(80));
  const p = page(state);
  const x = p.x + p.w - 6;
  // the page opens at its end, so the thumb sits at the foot of the track
  const before = state.ui.scroll.get('note.v');
  pointer(state, x, p.y + p.h - 6, { pressed: true, down: true });
  frame(state);
  assert.equal(state.ui.scroll.get('note.v'), before, 'taking hold of the thumb leaves the page where it was');
  pointer(state, x, p.y + p.h - 6, { pressed: false, down: false, released: true });
  frame(state);
});

import { padsOf, newPad, openPad, deletePad } from '../src/state/notes.js';

test('notepads: an old save becomes one pad, new pads switch and keep their text', () => {
  const g = { notes: 'old text' };
  assert.deepEqual(padsOf(g), [{ name: 'NOTES', text: 'old text' }]);
  newPad(g, 'leads');
  assert.equal(g.notes, '');
  g.notes = 'phone 555';
  openPad(g, 0);
  assert.equal(g.notes, 'old text');
  openPad(g, 1);
  assert.equal(g.notes, 'phone 555');
  assert.equal(g.notepads[1].name, 'LEADS');
  deletePad(g, 0);
  assert.equal(g.notes, 'phone 555');
  deletePad(g, 0);
  assert.deepEqual(g.notepads, [{ name: 'UNTITLED', text: '' }]);
  assert.equal(g.notes, '');
});

import { edit } from '../src/windows/notepad.js';

test('notepad: the arrows, Home and End move the caret, and typing goes in at it', () => {
  const k = (o) => ({ typed: '', ...o });
  let e = edit('abc\ndef', 7, k({ up: true }));
  assert.equal(e.caret, 3, 'up keeps the column');
  e = edit('abc\ndef', e.caret, k({ left: true, typed: 'X' }));
  assert.deepEqual(e, { text: 'abXc\ndef', caret: 3 });
  e = edit(e.text, e.caret, k({ home: true }));
  assert.equal(e.caret, 0);
  e = edit(e.text, e.caret, k({ downKey: true, end: true }));
  assert.equal(e.caret, 8, 'down, then End: the end of the second line');
  e = edit('abc', 1, k({ typed: '\b', delete: true }));
  assert.deepEqual(e, { text: 'c', caret: 0 });
});

test('notepads: new ones are UNTITLED, then UNTITLED 2', () => {
  const g = { notes: '' };
  assert.equal(padsOf(g)[0].name, 'UNTITLED');
  newPad(g);
  assert.equal(g.notepads[1].name, 'UNTITLED 2');
});
