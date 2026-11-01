// The cheat menu: a hidden window behind the BLACKGATE logo that changes the
// money, the heat, the clock, the rating and a few switches.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent, software, chassis } from '../src/data/content.js';
import { makeGame } from '../src/state/gameState.js';
import { makeInput, endFrame } from '../src/systems/input.js';
import { frameKeys } from '../src/systems/hotkeys.js';
import { makeUiState } from '../src/ui/kit.js';
import { makeWindows, openWindow, findWindow, WINDOWS } from '../src/state/windows.js';
import { drawPlay, desktop } from '../src/render/play.js';
import { startMenuRect } from '../src/render/startMenu.js';
import { handleEvents } from '../src/systems/events.js';
import { tick } from '../src/systems/tick.js';
import { connect } from '../src/systems/sessionTick.js';
import { theme, setDark } from '../src/core/theme.js';
import { saveRun, loadRun } from '../src/state/save.js';
import { stubCtx } from './stubCanvas.mjs';

await initContent();
const W = 1600;
const H = 900;
const DESK = desktop(W, H);

function playState() {
  return {
    view: { w: W, h: H }, wallpaper: null, input: makeInput(), ui: makeUiState(),
    windows: makeWindows(), game: makeGame('CHEAT', 7), win: {}, mode: 'play', time: 0,
  };
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
const click = (state, id) => handleEvents(state, [{ type: 'click', id }], DESK);
const account = (g) => g.player.accounts[0];
const offered = (g) => g.contracts.filter((c) => c.state === 'offered');

/// Fills the board, so there is a job to open a link to.
function withJob(state) {
  click(state, 'cheat.skip.60');
  return offered(state.game)[0];
}

// -- opening it -----------------------------------------------------------------

test('a click on the BLACKGATE logo opens the CHEATS window', () => {
  const state = playState();
  frame(state);
  // the logo sits at the left of the header, centred on its height
  Object.assign(state.input, { inside: true, mouse: { x: 27, y: 28 }, pressed: true, down: true });
  frame(state);
  const win = findWindow(state.windows, 'cheats');
  assert.ok(win, 'the window is open');
  assert.equal(win.title, 'CHEATS');
});

test('the cheat window is not in the Start menu, but is on the taskbar while open', () => {
  const state = playState();
  state.startOpen = true;
  let ctx = frame(state);
  const menu = startMenuRect({ x: 0, y: 0, w: W, h: H });
  const inMenu = (c) => c.texts.filter((t) => t.x >= menu.x && t.x <= menu.x + menu.w && t.y >= menu.y && t.y < H - 34);
  assert.ok(!inMenu(ctx).some((t) => t.s === 'CHEATS'));
  assert.ok(inMenu(ctx).some((t) => t.s === 'MAIL'), 'the other applications are listed');
  assert.ok(WINDOWS.find((w) => w.key === 'cheats').hidden);
  state.startOpen = false;
  openWindow(state.windows, 'cheats', DESK);
  ctx = frame(state);
  assert.ok(ctx.texts.some((t) => t.s.startsWith('CHEATS') && t.y > H - 34), 'a taskbar button');
});

test('the window draws in both skins', () => {
  for (const dark of [false, true]) {
    setDark(dark);
    const state = playState();
    openWindow(state.windows, 'cheats', DESK);
    const ctx = frame(state);
    for (const word of ['MONEY', 'HEAT', 'TIME', 'RATING']) {
      assert.ok(ctx.texts.some((t) => t.s.startsWith(word)), word);
    }
  }
  setDark(false);
});

// -- money ----------------------------------------------------------------------

test('money goes in and out of the credits, the account and the ledger together', () => {
  const state = playState();
  const g = state.game;
  const before = g.player.credits;
  const earned = g.stats.earned;
  click(state, 'cheat.money.10000');
  assert.equal(g.player.credits, before + 10000);
  assert.equal(account(g).balance, g.player.credits, 'the account follows');
  assert.equal(g.ledger.at(-1).amount, 10000);
  assert.equal(g.ledger.at(-1).reason, 'cheat');
  assert.equal(g.stats.earned, earned, 'cheat money is not earnings');
  click(state, 'cheat.money.-1000');
  assert.equal(g.player.credits, before + 9000);
  assert.equal(account(g).balance, g.player.credits);
  assert.equal(g.ledger.at(-1).amount, -1000);
});

test('money never goes below nothing, and can be set exactly', () => {
  const state = playState();
  const g = state.game;
  for (let i = 0; i < 10; i += 1) click(state, 'cheat.money.-1000');
  assert.equal(g.player.credits, 0);
  assert.equal(account(g).balance, 0);
  handleEvents(state, [{ type: 'edit', id: 'cheat.money.field', value: '123456' }], DESK);
  click(state, 'cheat.money.set');
  assert.equal(g.player.credits, 123456);
  assert.equal(account(g).balance, 123456);
  handleEvents(state, [{ type: 'edit', id: 'cheat.money.field', value: 'lots' }], DESK);
  click(state, 'cheat.money.set');
  assert.equal(g.player.credits, 123456, 'a figure that is not a number changes nothing');
});

// -- heat -----------------------------------------------------------------------

test('heat is set and nudged, and never reaches the raid', () => {
  const state = playState();
  const g = state.game;
  click(state, 'cheat.heat.set.75');
  assert.equal(g.player.heat, 75);
  for (let i = 0; i < 5; i += 1) click(state, 'cheat.heat.nudge.10');
  assert.equal(g.player.heat, 99, 'it stops short of 100');
  for (let i = 0; i < 20; i += 1) click(state, 'cheat.heat.nudge.-10');
  assert.equal(g.player.heat, 0);
});

test('frozen heat holds while the world tries to move it', () => {
  const state = playState();
  const g = state.game;
  click(state, 'cheat.heat.set.50');
  click(state, 'cheat.heat.freeze');
  g.player.heat = 90; // evidence lands
  tick(g, 1);
  assert.equal(g.player.heat, 50, 'held at the frozen value');
  click(state, 'cheat.heat.nudge.10');
  tick(g, 1);
  assert.equal(g.player.heat, 60, 'a nudge moves the frozen value with it');
  click(state, 'cheat.heat.freeze');
  tick(g, 10);
  assert.ok(g.player.heat < 60, 'thawed, it cools again');
});

// -- time -----------------------------------------------------------------------

function minutesIn(scale, seconds) {
  const state = playState();
  const g = state.game;
  if (scale) click(state, `cheat.time.${scale}`);
  const start = g.clock.minutes;
  for (let i = 0; i < seconds; i += 1) tick(g, 1);
  return g.clock.minutes - start;
}

test('the clock runs at the chosen speed', () => {
  const base = minutesIn(0, 60);
  assert.ok(base > 0);
  for (const scale of [1, 2, 4, 8, 16]) {
    const ran = minutesIn(scale, 60);
    assert.ok(Math.abs(ran - base * scale) <= scale, `${scale}x ran ${ran}, 1x ran ${base}`);
  }
});

test('pause stops the clock, and a speed starts it again', () => {
  const state = playState();
  const g = state.game;
  click(state, 'cheat.pause');
  assert.equal(g.paused, true);
  click(state, 'cheat.time.2');
  assert.equal(g.paused, false);
  assert.equal(g.settings.timeScale, 2);
});

test('the header speed button walks the same speeds', () => {
  const state = playState();
  const g = state.game;
  const seen = [];
  for (let i = 0; i < 5; i += 1) {
    click(state, 'hdr.speed');
    seen.push(g.settings.timeScale);
  }
  assert.deepEqual(seen, [2, 4, 8, 16, 1]);
  const ctx = frame(state);
  assert.ok(ctx.texts.some((t) => t.s === '1x' && t.y < 56), 'the header shows the speed');
});

test('the SYSTEM fast-forward box is the 8x speed', () => {
  const state = playState();
  const g = state.game;
  handleEvents(state, [{ type: 'toggle', id: 'set.fast', value: true }], DESK);
  assert.equal(g.settings.timeScale, 8);
  handleEvents(state, [{ type: 'toggle', id: 'set.fast', value: false }], DESK);
  assert.equal(g.settings.timeScale, 1);
});

test('skipping time runs the minutes: the clock moves and the board keeps up', () => {
  const state = playState();
  const g = state.game;
  const start = g.clock.minutes;
  click(state, 'cheat.skip.1440');
  assert.equal(g.clock.minutes, start + 1440);
  assert.equal(offered(g).length, 4, 'the board refilled');
});

test('time cannot be skipped with a link open', () => {
  const state = playState();
  const g = state.game;
  const job = withJob(state);
  assert.equal(connect(g, job.target), null);
  const start = g.clock.minutes;
  click(state, 'cheat.skip.60');
  assert.equal(g.clock.minutes, start, 'the clock did not jump');
  assert.ok(g.toasts.some((t) => /link/i.test(t.text)), 'and it says why');
});

// -- rating and the switches --------------------------------------------------------

test('the rating moves within its bounds', () => {
  const state = playState();
  const g = state.game;
  click(state, 'cheat.rating.10');
  assert.equal(g.player.rating, 12);
  for (let i = 0; i < 30; i += 1) click(state, 'cheat.rating.10');
  assert.equal(g.player.rating, 150);
  for (let i = 0; i < 30; i += 1) click(state, 'cheat.rating.-10');
  assert.equal(g.player.rating, 0);
});

test('a frozen trace stays where it is on a live link', () => {
  const state = playState();
  const g = state.game;
  const job = withJob(state);
  assert.equal(connect(g, job.target), null);
  click(state, 'cheat.trace.freeze');
  const s = g.session;
  Object.assign(s, { phase: 'online', alerted: true, traceRate: 0.5, trace: 0.2 });
  for (let i = 0; i < 10; i += 1) tick(g, 1);
  assert.ok(g.session, 'the link is still up');
  assert.equal(g.session.trace, 0.2, 'the trace did not move');
  assert.equal(g.gameOver, null);
});

test('reveal, tools and gateway do what they say', () => {
  const state = playState();
  const g = state.game;
  click(state, 'cheat.map');
  assert.ok(g.world.hosts.every((h) => h.discovered), 'every host is on the map');
  click(state, 'cheat.tools');
  assert.equal(g.player.tools.length, software().length);
  assert.ok(g.player.tools.every((t) => t.level === 5));
  click(state, 'cheat.gateway');
  const best = Math.max(...chassis().map((c) => c.tier));
  assert.equal(g.player.gateway.chassis, best, 'the best chassis');
  assert.ok(g.player.gateway.parts.every((p) => p.level === 5), 'the best parts');
  assert.ok(g.player.gateway.parts.length >= 4, 'every slot filled');
  assert.ok(g.player.gateway.migrateUntil <= g.clock.minutes, 'and no downtime');
});

test('the run is not marked as cheated', () => {
  const state = playState();
  const g = state.game;
  click(state, 'cheat.money.100000');
  click(state, 'cheat.tools');
  assert.ok(!('cheated' in g) && !g.stats.cheated && !g.player.flags.cheated);
});

// -- saves --------------------------------------------------------------------------

test('the cheat switches are kept with the run, and an old save loads without them', () => {
  const store = new Map();
  const saved = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  try {
    const state = playState();
    const g = state.game;
    click(state, 'cheat.time.4');
    click(state, 'cheat.trace.freeze');
    assert.ok(saveRun(g));
    const back = loadRun();
    assert.equal(back.settings.timeScale, 4);
    assert.equal(back.cheats.freezeTrace, true);
    // a run saved before the cheats
    delete g.cheats;
    delete g.settings.timeScale;
    g.settings.fastForward = true;
    assert.ok(saveRun(g));
    const old = loadRun();
    assert.equal(old.cheats.freezeTrace, false);
    assert.equal(old.cheats.freezeHeat, null);
    const s2 = { ...playState(), game: old };
    openWindow(s2.windows, 'cheats', DESK);
    assert.doesNotThrow(() => { tick(old, 1); frame(s2); });
    const ctx = frame(s2);
    assert.ok(ctx.texts.some((t) => t.s === '8x' && t.y < 56), 'an old fast-forward run keeps its 8x');
  } finally {
    globalThis.localStorage = saved;
  }
});

// -- the mission generator ------------------------------------------------------------

test('the mission generator posts a job of the chosen kind, with its offer mail', async () => {
  const { generateCustomContract } = await import('../src/state/contractSpawn.js');
  for (const kind of ['retrieve', 'delete', 'destroy', 'modify']) {
    const g = makeGame('GEN', 7);
    const mails = g.mail.length;
    const c = generateCustomContract(g, { kind });
    assert.ok(c, `${kind}: a job was posted`);
    assert.equal(c.kind, kind);
    assert.equal(c.state, 'offered', 'it is on the board');
    const mail = g.mail.at(-1);
    assert.equal(g.mail.length, mails + 1, 'one new mail');
    assert.equal(mail.contract, c.id, 'the mail offers this job');
    assert.equal(mail.read, false, 'it waits unread in the inbox');
  }
});

test('the generator can be pointed at a host, and says when that host cannot take the job', async () => {
  const { generateCustomContract } = await import('../src/state/contractSpawn.js');
  const { recordsKept } = await import('../src/state/gameState.js');
  const g = makeGame('GEN', 7);
  const gov = g.world.hosts.find((h) => h.company !== null && h.company !== undefined && recordsKept(g, h).length);
  const c = generateCustomContract(g, { kind: 'modify', target: gov.id });
  assert.equal(c.target, gov.id);
  const relay = g.world.hosts.find((h) => h.kind === 'relay');
  assert.equal(generateCustomContract(g, { kind: 'retrieve', target: relay.id }), null);
});

test('CHEATS has the button that opens the MISSION BUILDER', () => {
  const state = playState();
  openWindow(state.windows, 'cheats', DESK);
  const ctx = frame(state);
  assert.ok(ctx.texts.some((t) => t.s === 'OPEN MISSION BUILDER'));
});
