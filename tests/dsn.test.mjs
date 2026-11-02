// DeppSpaceNET: every page builds, links go somewhere, and the haggling
// follows its rules.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent, darknet } from '../src/data/content.js';
import { makeGame } from '../src/state/gameState.js';
import { makeInput } from '../src/systems/input.js';
import { makeUiState } from '../src/ui/kit.js';
import { makeWindows, openWindow } from '../src/state/windows.js';
import { drawPlay, desktop } from '../src/render/play.js';
import { handleEvents } from '../src/systems/events.js';
import { theme } from '../src/core/theme.js';
import { buildPage, normalize } from '../src/windows/dsn/pages.js';
import { haggleOdds, askFee, haggleTick, haggleOf, takeOffer, snubbed } from '../src/state/haggle.js';
import { offerCap } from '../src/systems/clockTick.js';
import { stubCtx } from './stubCanvas.mjs';

await initContent();
const DESK = desktop(1600, 900);

const ids = (page) => page.controls.flatMap((c) => (c.kind === 'buttons' ? c.items.map((b) => b.id) : []));
const offered = (g) => g.contracts.filter((c) => c.state === 'offered' && !c.story);

function playState() {
  return {
    view: { w: 1600, h: 900 }, wallpaper: null, input: makeInput(), ui: makeUiState(),
    windows: makeWindows(), game: makeGame('DSN', 7), win: {}, mode: 'play', time: 0,
  };
}

test('every page the hub links to builds, and none of them is a 404', () => {
  const g = makeGame('DSN', 7);
  const seen = new Set();
  // the sidebar and the job cards link to these
  const queue = ['hub', 'jobs', ...Object.keys(darknet().categories).map((k) => `cat/${k}`), ...offered(g).map((c) => `job/${c.id}`)];
  while (queue.length && seen.size < 80) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    const page = buildPage(g, url);
    assert.notEqual(page.title, '404 // DeppSpaceNET', `dsn://${url}`);
    ids(page).filter((id) => id.startsWith('dsn.go.')).forEach((id) => queue.push(normalize(id.slice(7))));
  }
  for (const want of ['hub', 'jobs', 'board', 'about']) assert.ok(seen.has(want), want);
  assert.ok([...seen].some((u) => u.startsWith('cat/')), 'categories');
  assert.ok([...seen].some((u) => u.startsWith('job/')), 'listings');
  assert.ok([...seen].some((u) => u.endsWith('.dsn')), 'broker sites');
  assert.ok([...seen].some((u) => u.startsWith('lookup/')), 'leak profiles');
});

test('an unknown address is a 404 with a way home', () => {
  const page = buildPage(makeGame('DSN', 7), 'dsn://nowhere.dsn');
  assert.match(page.title, /404/);
  assert.ok(ids(page).includes('dsn.go.hub'));
});

test('every broker has a site and every category a name', () => {
  const g = makeGame('DSN', 7);
  Object.values(darknet().brokers).forEach((b) => assert.equal(buildPage(g, b.domain).title, b.domain));
  ['retrieve', 'delete', 'modify', 'transfer', 'destroy', 'model'].forEach((k) => assert.ok(darknet().categories[k], k));
});

test('the board keeps more than four offers, more with rating', () => {
  const g = makeGame('DSN', 7);
  assert.ok(offerCap(g) > 4);
  g.player.rating = 150;
  assert.equal(offerCap(g), 10);
});

test('the odds fall with the ask and rise with the rating', () => {
  const g = makeGame('DSN', 7);
  const c = offered(g)[0];
  const small = haggleOdds(g, c, c.reward * 1.1);
  const big = haggleOdds(g, c, c.reward * 1.5);
  assert.ok(small > big);
  g.player.rating = 150;
  assert.ok(haggleOdds(g, c, c.reward * 1.5) > big, 'a legend gets more');
  assert.equal(haggleOdds(g, c, c.reward * 2.5), 0, 'more than double is an insult');
});

test('an ask is answered a few minutes later, once, and a yes raises the fee', () => {
  const g = makeGame('DSN', 7);
  g.player.rating = 150;
  const c = offered(g)[0];
  const was = c.reward;
  assert.equal(askFee(g, c.id, was * 1.01 + 1), null);
  assert.match(askFee(g, c.id, was * 1.2), /already/);
  haggleTick(g);
  assert.equal(haggleOf(g, c.id).state, 'waiting');
  g.clock.minutes += 30;
  haggleTick(g);
  const hg = haggleOf(g, c.id);
  assert.ok(['yes', 'counter', 'no'].includes(hg.state));
  if (hg.state === 'yes') assert.ok(c.reward > was);
  if (hg.state === 'counter') {
    assert.ok(hg.counter > was && hg.counter < hg.ask);
    assert.equal(takeOffer(g, c.id), null);
    assert.equal(c.reward, hg.counter);
    assert.equal(c.state, 'accepted');
  }
  assert.ok(hg.log.length >= 2, 'the client answered in the channel');
});

test('the same ask on the same job always gets the same answer', () => {
  const answer = () => {
    const g = makeGame('DSN', 7);
    const c = offered(g)[0];
    askFee(g, c.id, c.reward * 1.3);
    g.clock.minutes += 30;
    haggleTick(g);
    return haggleOf(g, c.id).state;
  };
  assert.equal(answer(), answer());
});

test('asking for more than double pulls the listing and the client stops dealing', () => {
  const g = makeGame('DSN', 7);
  const c = offered(g)[0];
  assert.equal(askFee(g, c.id, c.reward * 3), null);
  g.clock.minutes += 30;
  haggleTick(g);
  assert.equal(c.state, 'expired');
  assert.ok(snubbed(g, c.client));
  const other = g.contracts.find((x) => x.state === 'offered' && x.client === c.client);
  if (other) assert.match(askFee(g, other.id, other.reward * 1.1), /not taking your calls/);
});

test('the browser draws, navigates, goes back and accepts a job', () => {
  const state = playState();
  openWindow(state.windows, 'dsn', DESK);
  const frame = () => { const ctx = stubCtx(); state.game.uiTime += 1; drawPlay(ctx, theme(), 1600, 900, state, []); return ctx; };
  let ctx = frame();
  assert.ok(ctx.texts.some((t) => /ON THE MARKET/.test(t.s)), 'the hub');
  const c = offered(state.game)[0];
  handleEvents(state, [{ type: 'click', id: `dsn.go.job/${c.id}` }], DESK);
  ctx = frame();
  assert.ok(ctx.texts.some((t) => t.s.startsWith(`#${c.id} //`)), 'the listing');
  handleEvents(state, [{ type: 'click', id: `dsn.accept.${c.id}` }], DESK);
  assert.equal(c.state, 'accepted');
  handleEvents(state, [{ type: 'click', id: 'dsn.back' }], DESK);
  assert.equal(state.win.dsn.tabs[0].url, 'hub');
  handleEvents(state, [{ type: 'click', id: 'dsn.newtab' }], DESK);
  assert.equal(state.win.dsn.tabs.length, 2);
  assert.doesNotThrow(frame);
});

test('tabs close with their own button, and the last tab stays', async () => {
  const { handleDsnClick } = await import('../src/windows/dsn/browser.js');
  const view = {};
  handleDsnClick(view, 'dsn.newtab', 0);
  handleDsnClick(view, 'dsn.go.board', 0);
  handleDsnClick(view, 'dsn.newtab', 0);
  assert.equal(view.tabs.length, 3);
  handleDsnClick(view, 'dsn.closetab.1', 0);
  assert.deepEqual(view.tabs.map((t) => t.url), ['hub', 'hub']);
  handleDsnClick(view, 'dsn.closetab.0', 0);
  handleDsnClick(view, 'dsn.closetab.0', 0);
  assert.equal(view.tabs.length, 1, 'the last tab cannot be closed');
});

test('the CONTRACTS app is gone', async () => {
  const { WINDOWS } = await import('../src/state/windows.js');
  assert.ok(!WINDOWS.some((w) => w.key === 'contracts'));
  assert.ok(WINDOWS.some((w) => w.key === 'dsn'));
});
