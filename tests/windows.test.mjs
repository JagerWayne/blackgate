// The windows: every application draws a frame without throwing, and the
// tables draw inside their own box. Run with: node --test tests/*.mjs
import { startTask, LINK_DOWN } from '../src/systems/sessionTasks.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent } from '../src/data/content.js';
import { makeGame } from '../src/state/gameState.js';
import { makeInput, endFrame } from '../src/systems/input.js';
import { makeUiState } from '../src/ui/kit.js';
import { makeWindows, openWindow, WINDOWS } from '../src/state/windows.js';
import { drawPlay, desktop } from '../src/render/play.js';
import { handleEvents } from '../src/systems/events.js';
import { tick } from '../src/systems/tick.js';
import { theme } from '../src/core/theme.js';
import { drawTable, flex } from '../src/ui/table.js';
import { stubCtx } from './stubCanvas.mjs';

await initContent();

const KEYS = Array.isArray(WINDOWS) ? WINDOWS.map((x) => x.key ?? x) : Object.keys(WINDOWS);

test('every window draws a frame of a new run without throwing', () => {
  const w = 1600;
  const h = 900;
  for (const key of KEYS) {
    const ctx = stubCtx();
    const state = {
      view: { w, h }, wallpaper: null, input: makeInput(), ui: makeUiState(),
      windows: makeWindows(), game: makeGame('TEST', 7), win: {}, mode: 'play', time: 0,
    };
    openWindow(state.windows, key, desktop(w, h));
    assert.doesNotThrow(() => {
      for (let f = 0; f < 3; f += 1) {
        tick(state.game, 1 / 60);
        const events = [];
        drawPlay(ctx, theme(), w, h, state, events);
        handleEvents(state, events, desktop(w, h));
        endFrame(state.input);
      }
    }, `window ${key}`);
  }
});

test('the FILES tab of a live link shows the files on the host', () => {
  const w = 1600;
  const h = 900;
  const desk = desktop(w, h);
  const state = {
    view: { w, h }, wallpaper: null, input: makeInput(), ui: makeUiState(),
    windows: makeWindows(), game: makeGame('TEST', 7), win: {}, mode: 'play', time: 0,
  };
  const c = state.game.contracts.find((x) => x.state === 'offered');
  handleEvents(state, [{ type: 'click', id: `map.go.${c.target}` }], desk);
  assert.ok(state.game.session, 'the link is open');
  // the host shows nothing until the handshake is done
  for (let i = 0; i < 200 && state.game.session.phase !== 'online'; i += 1) tick(state.game, 0.25);
  handleEvents(state, [{ type: 'click', id: 'sess.tab.1' }], desk);
  assert.equal(state.win.blackgate.tab, 1, 'the FILES tab is the one picked');
  const ctx = stubCtx();
  drawPlay(ctx, theme(), w, h, state, []);
  const drawn = ctx.texts.map((t) => t.s);
  const host = state.game.world.hosts[c.target];
  assert.ok(drawn.includes(host.files[0].name), 'the file list is on the FILES tab');
  assert.ok(!drawn.includes('logs are written on the host'), 'the FILES tab is not the log note');
});

test('the LOGS tab of a live link shows what the host wrote down', () => {
  const w = 1600;
  const h = 900;
  const desk = desktop(w, h);
  const state = {
    view: { w, h }, wallpaper: null, input: makeInput(), ui: makeUiState(),
    windows: makeWindows(), game: makeGame('TEST', 7), win: {}, mode: 'play', time: 0,
  };
  const c = state.game.contracts.find((x) => x.state === 'offered');
  handleEvents(state, [{ type: 'click', id: `map.go.${c.target}` }], desk);
  state.game.session.phase = 'online';
  const host = state.game.world.hosts[c.target];
  assert.ok(host.logs.length > 0, 'the host has logs');
  handleEvents(state, [{ type: 'click', id: 'sess.tab.2' }], desk);
  assert.equal(state.win.blackgate.tab, 2, 'the LOGS tab is the one picked');
  const ctx = stubCtx();
  drawPlay(ctx, theme(), w, h, state, []);
  const drawn = ctx.texts.map((t) => t.s);
  assert.ok(drawn.includes(host.logs[0].text), 'the log line is on the tab');
});

test('a table draws extra cells and keeps every cell inside its box', () => {
  const ctx = stubCtx();
  const r = { x: 500, y: 100, w: 400, h: 200 };
  const sk = theme();
  const rows = [{ cells: [{ text: 'FROM' }, { text: 'WHEN', align: 'right' }, { text: 'SUBJECT', line: 1 }] }];
  const table = { id: 't', columns: [flex('A', 0.5), flex('B', 0.5, 'right')], rows };
  assert.doesNotThrow(() => drawTable(ctx, sk, r, table, makeUiState(), makeInput(), []));
  const drawn = ctx.texts.map((t) => t.s);
  for (const want of ['FROM', 'WHEN', 'SUBJECT']) assert.ok(drawn.includes(want), `${want} drawn`);
  ctx.texts.forEach((t) => {
    assert.ok(t.x >= r.x && t.x <= r.x + r.w, `${t.s} at x=${t.x} is outside ${r.x}..${r.x + r.w}`);
  });
});

test('while the link is negotiating the host shows nothing and refuses tasks', () => {
  const w = 1600;
  const h = 900;
  const desk = desktop(w, h);
  const state = {
    view: { w, h }, wallpaper: null, input: makeInput(), ui: makeUiState(),
    windows: makeWindows(), game: makeGame('TEST', 7), win: {}, mode: 'play', time: 0,
  };
  const c = state.game.contracts.find((x) => x.state === 'offered');
  handleEvents(state, [{ type: 'click', id: `map.go.${c.target}` }], desk);
  handleEvents(state, [{ type: 'click', id: 'sess.tab.1' }], desk);
  const host = state.game.world.hosts[c.target];
  const ctx = stubCtx();
  drawPlay(ctx, theme(), w, h, state, []);
  const drawn = ctx.texts.map((t) => t.s);
  assert.ok(!drawn.includes(host.files[0].name), 'no files before the link is up');
  assert.ok(drawn.includes('NEGOTIATING LINK'));
  assert.equal(startTask(state.game, 'CopyFile', 0), LINK_DOWN);
});
