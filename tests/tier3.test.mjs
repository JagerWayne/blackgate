// Tier 3 of the GUI audit: the shell says when work arrives and leaves, the
// link window knows its job, the map follows its pick, the risky buttons ask
// twice, and the keyboard does something.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent } from '../src/data/content.js';
import { makeGame } from '../src/state/gameState.js';
import { makeInput, endFrame } from '../src/systems/input.js';
import { frameKeys } from '../src/systems/hotkeys.js';
import { makeUiState } from '../src/ui/kit.js';
import { makeWindows, openWindow, WINDOWS } from '../src/state/windows.js';
import { drawPlay, desktop } from '../src/render/play.js';
import { handleEvents } from '../src/systems/events.js';
import { onMinutes } from '../src/systems/clockTick.js';
import { connect } from '../src/systems/sessionTick.js';
import { advance } from '../src/core/clock.js';
import { theme } from '../src/core/theme.js';
import { versionEffect } from '../src/state/toolEffects.js';
import { stubCtx } from './stubCanvas.mjs';

await initContent();
const W = 1600;
const H = 900;
const DESK = desktop(W, H);

function playState() {
  return {
    view: { w: W, h: H }, wallpaper: null, input: makeInput(), ui: makeUiState(),
    windows: makeWindows(), game: makeGame('TIER3', 7), win: {}, mode: 'play', time: 0,
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
const has = (ctx, re) => ctx.texts.some((t) => re.test(t.s));
const offers = (g) => g.contracts.filter((c) => c.state === 'offered');

// -- work arriving and leaving --------------------------------------------------

test('a new job on the board is announced', () => {
  const state = playState();
  const g = state.game;
  const job = offers(g)[0];
  job.state = 'accepted'; // the board is one short and refills
  g.toasts = [];
  onMinutes(g, 1);
  assert.ok(g.toasts.some((t) => /^New listing #\d+/.test(t.text)), 'a toast names the new job');
});

test('an offer whose window closes moves to the history with a word', () => {
  const state = playState();
  const g = state.game;
  const job = offers(g)[0];
  g.toasts = [];
  advance(g.clock, job.deadline - g.clock.minutes + 1);
  onMinutes(g, 1);
  assert.equal(job.state, 'expired', 'it is in the history, not gone');
  assert.ok(g.contracts.includes(job));
  assert.ok(g.toasts.some((t) => t.text.includes(`#${job.id} withdrawn`)));
});

test('the header counts the unread mail and opens it', () => {
  const state = playState();
  const unread = state.game.mail.filter((m) => !m.read).length;
  const ctx = frame(state);
  assert.ok(has(ctx, new RegExp(`^MAIL ${unread}$`)), 'the header shows the count');
  click(state, 'hdr.mail');
  assert.ok(state.windows.list.some((w) => w.key === 'mail'));
});

test('the taskbar keeps every window button clear of the clock', () => {
  const state = playState();
  WINDOWS.forEach((d) => openWindow(state.windows, d.key, DESK));
  const ctx = frame(state);
  const tray = W - 160;
  const titles = WINDOWS.map((d) => d.title);
  const onBar = ctx.texts.filter((t) => t.y > H - 60 && titles.some((s) => t.s.startsWith(s.slice(0, 3))));
  assert.ok(onBar.length > 0, 'the buttons are drawn');
  assert.ok(onBar.every((t) => t.x < tray), 'none runs under the tray');
});

// -- the link window and the contract -------------------------------------------

test('OPEN THE LINK on a taken job opens the link to its target', () => {
  const state = playState();
  const g = state.game;
  const job = offers(g)[0];
  click(state, `ct.accept.${job.id}`);
  click(state, `ct.link.${job.id}`);
  assert.equal(g.session?.target, job.target);
  assert.ok(state.windows.list.some((w) => w.key === 'blackgate'));
});

test('the link window names its job, the objective file and the trace threshold', () => {
  const state = playState();
  const g = state.game;
  const job = offers(g)[0];
  click(state, `ct.accept.${job.id}`);
  click(state, `ct.link.${job.id}`);
  g.session.phase = 'online';
  state.win.blackgate = { tab: 1 };
  const ctx = frame(state);
  assert.ok(has(ctx, new RegExp(`^#${job.id} `)), 'the JOB block names it');
  assert.ok(has(ctx, /WARNS AT \d+%/), 'the trace says where it warns');
  assert.ok(has(ctx, /^GATEWAY \/\/ \d+ GB FREE OF \d+$/), 'the files tab shows the free space');
  if (job.file) assert.ok(has(ctx, /^OBJECTIVE$/), 'the objective file is marked');
});

test('the access tab shows the breaker beside each lock', () => {
  const state = playState();
  const g = state.game;
  const job = offers(g)[0];
  assert.equal(connect(g, job.target), null);
  g.session.phase = 'online';
  state.win.blackgate = { tab: 0 };
  openWindow(state.windows, 'blackgate', DESK);
  const ctx = frame(state);
  const locked = g.world.hosts[job.target].services.some((s) => !s.open);
  if (locked) assert.ok(has(ctx, /^YOUR BREAKER v\d$/));
});

// -- the map ------------------------------------------------------------------------

test('SHOW TARGET scrolls the host list to the picked host', () => {
  const state = playState();
  const g = state.game;
  // the last host alphabetically is the one most likely to be off-screen
  const known = g.world.hosts.filter((h) => h.discovered).sort((a, b) => a.name.localeCompare(b.name));
  const last = known.at(-1);
  const job = offers(g)[0];
  job.target = last.id;
  click(state, `ct.track.${job.id}`);
  frame(state);
  assert.equal(state.win.map.sel, last.id);
  assert.ok((state.ui.scroll.get('map.list') ?? 0) > 0, 'the list scrolled down to it');
  assert.equal(state.win.map.follow, false, 'it follows once, then the operator scrolls');
});

test('the map has a legend', () => {
  const state = playState();
  openWindow(state.windows, 'map', DESK);
  const ctx = frame(state);
  for (const word of ['COMPANY HOST', 'INDEPENDENT', 'FAVOURITE', 'ROUTE HOPS']) {
    assert.ok(has(ctx, new RegExp(`^${word}$`)), word);
  }
});

// -- SOFTWARE and GATEWAY -----------------------------------------------------------

test('a software version says what it does', () => {
  assert.equal(versionEffect('PasswordCracker', 3), 'beats locks up to v3');
  assert.equal(versionEffect('MonitorBypass', 3), 'blinds monitors up to strength 3');
  assert.match(versionEffect('LanScan', 1), /no task/);
  const state = playState();
  openWindow(state.windows, 'software', DESK);
  const ctx = frame(state);
  assert.ok(has(ctx, /^V1 /), 'versions carry their number');
  assert.ok(has(ctx, /^beats locks up to v1$/), 'and their effect');
});

test('REMOVE takes two clicks and says the part goes to stock', () => {
  const state = playState();
  const g = state.game;
  openWindow(state.windows, 'gateway', DESK);
  const parts = g.player.gateway.parts.length;
  click(state, 'gw.sell.0');
  assert.equal(g.player.gateway.parts.length, parts, 'the first click only arms it');
  const ctx = frame(state);
  assert.ok(has(ctx, /^moves to stock$/));
  assert.ok(has(ctx, /^CONFIRM$/), 'the armed button asks for the second click');
  click(state, 'gw.sell.0');
  assert.equal(g.player.gateway.parts.length, parts - 1, 'the second click removes it');
});

test('any other GATEWAY click puts an armed button down', () => {
  const state = playState();
  const g = state.game;
  openWindow(state.windows, 'gateway', DESK);
  const parts = g.player.gateway.parts.length;
  click(state, 'gw.sell.0');
  click(state, 'gw.tab.1');
  click(state, 'gw.sell.0');
  assert.equal(g.player.gateway.parts.length, parts, 'the arm was lost: this click only re-arms');
});

// -- STORAGE, notepad, BANKING ------------------------------------------------------

test('a finished job can be handed in from STORAGE', () => {
  const state = playState();
  const g = state.game;
  const job = offers(g)[0];
  job.state = 'ready';
  g.player.storage.push({ name: job.file ?? 'loot.db', size: 1, source: 'x', enc: 0, tag: job.id });
  openWindow(state.windows, 'files', DESK);
  const ctx = frame(state);
  assert.ok(has(ctx, /^SUBMIT WORK$/));
  click(state, `ct.submit.${job.id}`);
  assert.equal(job.state, 'done');
});

test('the notepad page clears on a second click', () => {
  const state = playState();
  state.game.notes = 'keep this';
  click(state, 'note.clear');
  assert.equal(state.game.notes, 'keep this', 'the first click only arms it');
  click(state, 'note.clear');
  assert.equal(state.game.notes, '');
});

test('BANKING keeps every movement, not only the last twelve', () => {
  const state = playState();
  const g = state.game;
  for (let i = 0; i < 30; i += 1) g.ledger.push({ minute: i, amount: i + 1, reason: `test ${i}`, balance: 0 });
  openWindow(state.windows, 'bank', DESK);
  const ctx = frame(state);
  assert.ok(has(ctx, /^LEDGER \/\/ 30 entries/));
  assert.ok(has(ctx, /^ACCOUNTS \/\/ \d+$/));
});

// -- the keyboard -------------------------------------------------------------------

test('Tab walks the fields and Escape leaves them', () => {
  const state = playState();
  openWindow(state.windows, 'map', DESK);
  frame(state);
  state.input.tab = true;
  frame(state);
  assert.equal(state.ui.focus, 'map.search');
  state.win.map.query = 'relay';
  state.input.esc = true;
  frame(state);
  assert.equal(state.ui.focus, null);
  assert.equal(state.win.map.query, '', 'Escape out of the search clears it');
});

test('Enter presses the default button', () => {
  const state = playState();
  const g = state.game;
  const picked = g.contracts.find((c) => c.state === 'offered').id;
  openWindow(state.windows, 'dsn', DESK);
  handleEvents(state, [{ type: 'click', id: `dsn.go.job/${picked}` }], DESK);
  g.uiTime += 2;
  frame(state);
  state.input.enter = true;
  frame(state);
  frame(state);
  assert.equal(g.contracts.find((c) => c.id === picked).state, 'accepted', 'Enter accepted the picked offer');
});

test('Enter in the notes is a new line, not a button', () => {
  const state = playState();
  openWindow(state.windows, 'dsn', DESK);
  const note = openWindow(state.windows, 'notepad', DESK);
  frame(state);
  Object.assign(state.input, { inside: true, mouse: { x: note.x + note.w / 2, y: note.y + note.h / 2 }, pressed: true, down: true });
  frame(state);
  Object.assign(state.input, { pressed: false, down: false });
  state.input.enter = true;
  state.input.typed = '\n';
  frame(state);
  assert.ok(state.game.contracts.every((c) => c.state !== 'accepted'), 'nothing was accepted');
  assert.equal(state.game.notes, '\n');
});

test('a part sold from stock pays into the account and the ledger, not only the total', () => {
  const state = playState();
  const g = state.game;
  const acct = g.player.accounts[0];
  click(state, 'gw.sell.0');
  click(state, 'gw.sell.0');
  assert.equal(g.player.stock.length, 1, 'REMOVE puts the part in stock');
  const before = { credits: g.player.credits, balance: acct.balance, earned: g.stats.earned, moves: g.ledger.length };
  click(state, 'gw.stock.sell.0');
  click(state, 'gw.stock.sell.0');
  const back = g.player.credits - before.credits;
  assert.ok(back > 0, 'the refund was paid');
  assert.equal(acct.balance - before.balance, back, 'the account holds it too');
  assert.equal(g.ledger.length, before.moves + 1, 'the ledger books it');
  assert.equal(g.ledger.at(-1).amount, back);
  assert.equal(g.stats.earned, before.earned, 'a refund is not earnings');
});
