// DSNET: every page builds, links go somewhere, and the haggling
// follows its rules.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent, darknet } from '../src/data/content.js';
import { makeGame } from '../src/state/gameState.js';
import { makeInput } from '../src/systems/input.js';
import { makeUiState } from '../src/ui/kit.js';
import { makeWindows, openWindow, findWindow } from '../src/state/windows.js';
import { drawPlay, desktop } from '../src/render/play.js';
import { handleEvents, openPortal } from '../src/systems/events.js';
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
    assert.notEqual(page.title, '404 // DSNET', `dsn://${url}`);
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
  openPortal(state, DESK);
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
  assert.deepEqual(view.tabs.map((t) => t.url), ['start', 'start']);
  handleDsnClick(view, 'dsn.closetab.0', 0);
  handleDsnClick(view, 'dsn.closetab.0', 0);
  assert.equal(view.tabs.length, 1, 'the last tab cannot be closed');
});

test('the CONTRACTS app is gone', async () => {
  const { WINDOWS } = await import('../src/state/windows.js');
  assert.ok(!WINDOWS.some((w) => w.key === 'contracts'));
  assert.ok(WINDOWS.some((w) => w.key === 'dsn'));
});

import { declineDeal, counterAsk } from '../src/state/haggle.js';
import { routeLines, makeSession } from '../src/state/session.js';

test('decline: the listing goes and the chat says so', () => {
  const state = playState();
  const g = state.game;
  const c = offered(g)[0];
  handleEvents(state, [{ type: 'click', id: `dsn.decline.${c.id}` }], DESK);
  assert.equal(c.state, 'offered', 'the first press only arms it');
  handleEvents(state, [{ type: 'click', id: `dsn.decline.${c.id}` }], DESK);
  assert.equal(c.state, 'expired');
  assert.equal(haggleOf(g, c.id).log.at(-1).who, 'you');
  assert.ok(declineDeal(g, c.id), 'a closed listing cannot be declined again');
});

test('counter: answer a counter-offer once, between their figure and your ask', () => {
  const state = playState();
  const g = state.game;
  const c = offered(g)[0];
  askFee(g, c.id, c.reward * 1.5);
  const hg = haggleOf(g, c.id);
  Object.assign(hg, { state: 'counter', counter: Math.round(c.reward * 1.25) });
  assert.ok(counterAsk(g, c.id, hg.counter), 'not at or below their counter');
  assert.ok(counterAsk(g, c.id, hg.ask), 'not at or above your own ask');
  assert.equal(counterAsk(g, c.id, hg.counter + 10), null);
  assert.equal(hg.state, 'waiting');
  assert.equal(hg.round, 2);
  g.clock.minutes = hg.replyAt;
  haggleTick(g);
  assert.ok(['yes', 'no'].includes(hg.state), 'the second round ends in yes or no, never another counter');
});

test('the link log routes through each hop before it reaches the target', () => {
  const state = playState();
  const g = state.game;
  const ids = g.world.hosts.slice(1, 4).map((h) => h.id);
  const s = makeSession(ids[2], ids.slice(0, 2), 10);
  s.connectT = 0;
  assert.equal(routeLines(g, s).length, 1);
  assert.match(routeLines(g, s)[0].text, /^Routing via /);
  s.connectT = 10;
  const lines = routeLines(g, s);
  assert.equal(lines.length, 3);
  assert.match(lines[2].text, /^Reaching .*connected$/);
  assert.ok(lines.every((l) => l.done));
});

test('the map kind dropdown opens, picks a kind and closes', () => {
  const state = playState();
  openWindow(state.windows, 'map', DESK);
  handleEvents(state, [{ type: 'click', id: 'map.kmenu' }], DESK);
  assert.equal(state.win.map.kindOpen, true);
  handleEvents(state, [{ type: 'click', id: 'map.k.relay' }], DESK);
  assert.equal(state.win.map.kind, 'relay');
  assert.equal(state.win.map.kindOpen, false);
});

test('the hub link "manage your jobs" opens MY JOBS when clicked', () => {
  const state = playState();
  const g = state.game;
  takeOffer(g, offered(g)[0].id);
  openPortal(state, DESK);
  const draw = () => {
    const ctx = stubCtx();
    const ev = [];
    state.game.uiTime += 5;
    drawPlay(ctx, theme(), 1600, 900, state, ev);
    handleEvents(state, ev, DESK);
    return ctx;
  };
  draw();
  const t = draw().texts.find((x) => /^manage your/.test(x.s));
  assert.ok(t, 'the link is drawn');
  // the sidebar's MY JOBS link is drawn first: it must not swallow this click
  Object.assign(state.input, { mouse: { x: t.x + 5, y: t.y + 2 }, inside: true, pressed: true, down: true });
  draw();
  Object.assign(state.input, { pressed: false, down: false, released: true });
  draw();
  const v = state.win.dsn;
  assert.equal(v.tabs[v.active].url, 'jobs');
});

import { parseText } from '../tools/socialmedia.mjs';
import { postOf, matches } from '../src/windows/dsn/sleek.js';
import { isPublic, learn, knows } from '../src/state/intel.js';
import { siteUrl, siteTheme, THEMES, staffOf } from '../src/state/sites.js';
import { socialImages, socialText } from '../src/data/content.js';
import { readFileSync } from 'node:fs';

test('populate: text.txt splits into its topics, numbers stripped', () => {
  const t = parseText(readFileSync(new URL('../data/images/socialmedia/text.txt', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(t).sort(), ['cars', 'city', 'food', 'pets']);
  assert.ok(t.cars.length > 10);
  assert.ok(t.cars.every((line) => !/^\d+\./.test(line)));
  assert.deepEqual(Object.keys(socialImages()).sort(), Object.keys(socialText()).sort(), 'a photo folder for every topic');
});

test('SleekPages: the start page, the feed, profiles and the directory build and link', () => {
  const g = makeGame('SP', 7);
  for (const url of ['start', 'sleekpages', 'sleekpages.com', 'sleekpages/people', 'sleekpages/person/0', 'dsnet']) {
    assert.notEqual(buildPage(g, url).title, '404', url);
  }
  assert.equal(normalize('dsnet'), 'hub');
  assert.deepEqual(ids(buildPage(g, 'start')).sort(), ['dsn.go.directory', 'dsn.go.hub', 'dsn.go.sleekpages']);
  assert.equal(buildPage(g, 'sleekpages/person/9999').title, '404');
});

test('SleekPages: posts pair a topic photo with a caption from that topic, the same every time', () => {
  const g = makeGame('SP', 7);
  const a = postOf(g, 'feed3');
  assert.deepEqual(postOf(g, 'feed3'), a);
  assert.ok(a.image.includes(`/socialmedia/${a.topic}/`));
  assert.ok(socialText()[a.topic].includes(a.text));
  const open = g.world.people.filter((_, i) => isPublic(g, i, 'email')).length;
  assert.ok(open > 0 && open < g.world.people.length, 'some profiles are public, not all');
});

test('SleekPages: VIEW DOSSIER puts the person on file and opens DOSSIERS', () => {
  const state = playState();
  handleEvents(state, [{ type: 'click', id: 'sp.dossier.5' }], DESK);
  assert.ok(state.game.intel?.[5], 'on file as a lead');
  assert.ok(findWindow(state.windows, 'dossiers'), 'DOSSIERS is open');
});

test('SleekPages pages draw without throwing', () => {
  for (const url of ['start', 'sleekpages', 'sleekpages/people', 'sleekpages/person/3']) {
    const state = playState();
    openPortal(state, DESK, url);
    state.game.uiTime = 99;
    const ctx = stubCtx();
    assert.doesNotThrow(() => drawPlay(ctx, theme(), 1600, 900, state, []), url);
    assert.ok(ctx.texts.length > 5, url);
  }
});

test('company sites: 40 addresses that open their home, team and contact pages; the directory lists them', () => {
  const g = makeGame('WEB', 7);
  const urls = g.world.companies.map(siteUrl);
  assert.equal(new Set(urls).size, 40, 'every address unique');
  urls.forEach((u) => {
    for (const sub of ['', '/team', '/contact']) assert.notEqual(buildPage(g, u + sub).title, '404', u + sub);
  });
  assert.equal(buildPage(g, `${urls[0]}/nope`).title, '404');
  assert.ok(new Set(g.world.companies.map((_, ci) => siteTheme(g, ci).name)).size >= 6, 'many of the ten looks in use');
  assert.equal(THEMES.length, 10);
  assert.equal(buildPage(g, 'directory').title, 'directory');
  assert.ok(ids(buildPage(g, 'start')).includes('dsn.go.directory'));
});

test('a click on a public email files it: the dossier knows it and the inbox tasks open', () => {
  const state = playState();
  const g = state.game;
  const i = g.world.people.findIndex((_, k) => isPublic(g, k, 'email') && !g.intel?.[k]);
  assert.equal(knows(g, i, 'email'), false);
  handleEvents(state, [{ type: 'click', id: `sp.learn.${i}.email` }], DESK);
  assert.equal(knows(g, i, 'email'), true);
  assert.equal(knows(g, i, 'phone'), false, 'only that detail');
  assert.ok(g.toasts.some((t) => /EMAIL of .* added to the dossier/.test(t.text)));
  assert.equal(learn(g, i, 'email'), false, 'a second click adds nothing');
});

test('company sites draw their team with photos and details', () => {
  const state = playState();
  const ci = 3;
  openPortal(state, DESK, `${siteUrl(state.game.world.companies[ci])}/team`);
  state.game.uiTime = 99;
  const ctx = stubCtx();
  drawPlay(ctx, theme(), 1600, 900, state, []);
  const names = staffOf(state.game, ci).map((i) => state.game.world.people[i].name.toLowerCase());
  assert.ok(ctx.texts.some((t) => names.includes(t.s.toLowerCase())), 'a staff name is drawn');
});

test('SleekPages: the feed changes on reload, the search finds people, fifty to a page', () => {
  const state = playState();
  const g = state.game;
  openPortal(state, DESK, 'sleekpages');
  const a = buildPage(g, 'sleekpages', { tabs: [{ at: 1 }], active: 0 });
  const b = buildPage(g, 'sleekpages', { tabs: [{ at: 2 }], active: 0 });
  assert.notDeepEqual(postOf(g, 'feed1:0'), postOf(g, 'feed2:0'));
  assert.ok(a.controls.length > 5 && b.controls.length > 5);
  const target = g.world.people[1234];
  assert.ok(matches(g, target, target.name.toLowerCase()));
  handleEvents(state, [{ type: 'edit', id: 'sp.q', value: target.name.split(' ')[1] }], DESK);
  assert.equal(state.win.dsn.spQuery, target.name.split(' ')[1]);
  const page = buildPage(g, 'sleekpages/people', state.win.dsn);
  assert.ok(page.controls.length >= 4, 'the search field, the button and the rows');
});
