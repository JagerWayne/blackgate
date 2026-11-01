// The NEXUS MAP: the search, the kind filters, the bounce route and the
// routes kept for later.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent } from '../src/data/content.js';
import { makeGame } from '../src/state/gameState.js';
import { makeInput } from '../src/systems/input.js';
import { makeUiState } from '../src/ui/kit.js';
import { makeWindows, openWindow } from '../src/state/windows.js';
import { drawPlay, desktop } from '../src/render/play.js';
import { handleEvents } from '../src/systems/events.js';
import { frameKeys } from '../src/systems/hotkeys.js';
import { theme, isDark, setDark } from '../src/core/theme.js';
import { mapHosts, filterCount } from '../src/state/mapQuery.js';
import { MAX_HOPS, MAX_ROUTES } from '../src/state/routes.js';
import { stubCtx } from './stubCanvas.mjs';

await initContent();
const W = 1600;
const H = 900;
const DESK = desktop(W, H);

function mapState() {
  const state = {
    view: { w: W, h: H }, wallpaper: null, input: makeInput(), ui: makeUiState(),
    windows: makeWindows(), game: makeGame('MAP', 7), win: {}, mode: 'play', time: 0,
  };
  openWindow(state.windows, 'map', DESK);
  drawPlay(stubCtx(), theme(), W, H, state, []);
  return state;
}
const click = (state, id) => handleEvents(state, [{ type: 'click', id }], DESK);
const known = (game) => game.world.hosts.filter((h) => h.discovered);

test('a kind filter shows only hosts of that kind', () => {
  const state = mapState();
  click(state, 'map.k.relay');
  const shown = mapHosts(state.game, state.win.map);
  assert.ok(shown.length > 0, 'the start of a run knows some relays');
  assert.ok(shown.every((h) => h.kind === 'relay'));
  assert.equal(shown.length, filterCount(state.game, 'relay'));
  click(state, 'map.k.all');
  assert.equal(mapHosts(state.game, state.win.map).length, known(state.game).length);
});

test('the search matches the name, the address and the kind', () => {
  const state = mapState();
  const view = state.win.map;
  const host = known(state.game)[0];
  view.query = host.ip;
  assert.deepEqual(mapHosts(state.game, view).map((h) => h.id), [host.id]);
  view.query = host.name.toUpperCase();
  assert.ok(mapHosts(state.game, view).some((h) => h.id === host.id), 'case does not matter');
  view.query = 'relay';
  assert.ok(mapHosts(state.game, view).every((h) => h.kind === 'relay' || h.name.includes('relay')));
  view.query = 'no host is called this';
  assert.equal(mapHosts(state.game, view).length, 0);
  const ctx = stubCtx();
  drawPlay(ctx, theme(), W, H, state, []);
  assert.ok(ctx.texts.some((t) => t.s.startsWith('nothing matches')), 'an empty search says so');
});

test('typing D into the search does not swap the skin', () => {
  const state = mapState();
  const before = isDark();
  state.ui.focus = 'map.search';
  state.input.text = 'd';
  frameKeys(state);
  assert.equal(isDark(), before);
  setDark(false);
});

test('picking a host in the list selects it for the detail pane', () => {
  const state = mapState();
  click(state, 'map.k.relay');
  const relays = mapHosts(state.game, state.win.map);
  handleEvents(state, [{ type: 'select', id: 'map.list', index: 1 }], DESK);
  assert.equal(state.win.map.sel, relays[1].id);
  const ctx = stubCtx();
  drawPlay(ctx, theme(), W, H, state, []);
  assert.ok(ctx.texts.some((t) => t.s === 'ADD TO ROUTE'), 'the detail pane offers the route');
});

test('relays go into the route in order, and come out again', () => {
  const state = mapState();
  const g = state.game;
  const relays = known(g).filter((h) => h.kind === 'relay').slice(0, 3);
  relays.forEach((h) => click(state, `map.hop.${h.id}`));
  assert.deepEqual(g.player.bounce, relays.map((h) => h.id));
  click(state, `map.hop.${relays[1].id}`);
  assert.deepEqual(g.player.bounce, [relays[0].id, relays[2].id]);
  click(state, 'map.route.clear');
  assert.deepEqual(g.player.bounce, []);
});

test('a route never takes more than its limit of hops', () => {
  const state = mapState();
  const g = state.game;
  known(g).slice(0, MAX_HOPS + 2).forEach((h) => click(state, `map.hop.${h.id}`));
  assert.equal(g.player.bounce.length, Math.min(MAX_HOPS, known(g).length));
});

test('a route is kept, used again and forgotten', () => {
  const state = mapState();
  const g = state.game;
  const relays = known(g).filter((h) => h.kind === 'relay').slice(0, 2);
  relays.forEach((h) => click(state, `map.hop.${h.id}`));
  click(state, 'map.route.save');
  assert.equal(g.routes.length, 1);
  assert.equal(g.routes[0].name, 'ROUTE 1');
  assert.deepEqual(g.routes[0].hops, relays.map((h) => h.id));
  click(state, 'map.route.save');
  assert.equal(g.routes.length, 1, 'the same route is not kept twice');
  click(state, 'map.route.clear');
  click(state, 'map.route.load.0');
  assert.deepEqual(g.player.bounce, relays.map((h) => h.id), 'loading puts the hops back');
  click(state, 'map.route.del.0');
  assert.equal(g.routes.length, 0);
});

test('only so many routes are kept', () => {
  const state = mapState();
  const g = state.game;
  const hosts = known(g);
  for (let i = 0; i < MAX_ROUTES + 2; i += 1) {
    click(state, 'map.route.clear');
    click(state, `map.hop.${hosts[i % hosts.length].id}`);
    click(state, `map.hop.${hosts[(i + 1) % hosts.length].id}`);
    click(state, 'map.route.save');
  }
  assert.equal(g.routes.length, MAX_ROUTES);
});

test('a run saved before routes existed still draws the map', () => {
  const state = mapState();
  delete state.game.routes;
  assert.doesNotThrow(() => drawPlay(stubCtx(), theme(), W, H, state, []));
  click(state, `map.hop.${known(state.game)[0].id}`);
  click(state, 'map.route.save');
  assert.equal(state.game.routes.length, 1);
});

test('a favourite is marked and found by its filter', () => {
  const state = mapState();
  const host = known(state.game)[2];
  click(state, `map.fav.${host.id}`);
  click(state, 'map.k.fav');
  assert.deepEqual(mapHosts(state.game, state.win.map).map((h) => h.id), [host.id]);
  click(state, `map.fav.${host.id}`);
  assert.equal(mapHosts(state.game, state.win.map).length, 0);
});

test('SHOW TARGET opens the map on the machine the job names', () => {
  const state = mapState();
  const c = state.game.contracts.find((x) => x.state === 'offered');
  assert.ok(c, 'the board has work on it');
  state.win.map.kind = 'relay';
  state.win.map.query = 'nothing matches this';
  click(state, `ct.track.${c.id}`);
  const view = state.win.map;
  assert.equal(view.sel, c.target, 'the machine is picked on the map');
  assert.equal(view.kind, 'all', 'the kind filter is cleared');
  assert.equal(view.query, '', 'the search is cleared');
  assert.ok(mapHosts(state.game, view).some((h) => h.id === c.target), 'the machine is listed');

  state.win.map.sel = 0;
  state.win.map.kind = 'relay';
  click(state, `mail.track.${c.id}`);
  assert.equal(state.win.map.sel, c.target, 'the mail button finds it as well');
  assert.equal(state.win.map.kind, 'all', 'the kind filter is cleared');
});

test('LINK still opens a link through the route', () => {
  const state = mapState();
  const g = state.game;
  const relay = known(g).find((h) => h.kind === 'relay');
  const target = known(g).find((h) => h.kind !== 'relay');
  click(state, `map.hop.${relay.id}`);
  click(state, `map.go.${target.id}`);
  assert.ok(g.session, 'the link is open');
  assert.equal(g.session.target, target.id);
  assert.deepEqual(g.session.route, [relay.id]);
});

test('the world map zooms about the pointer, pans with a drag, and stays on the image', async () => {
  const { panZoom, MAX_ZOOM } = await import('../src/windows/mapWorld.js');
  const r = { x: 0, y: 0, w: 1000, h: 500 };
  const view = {};
  const input = { ...makeInput(), inside: true, mouse: { x: 250, y: 125 }, scroll: 100 };
  panZoom(view, r, input);
  assert.equal(view.zoom, 1.25);
  // the point under the pointer (a quarter of the way in) stays under it
  assert.ok(Math.abs(view.ox + 250 / (1000 * view.zoom) - 0.25) < 1e-9);
  input.scroll = 0;
  Object.assign(input, { pressed: true, down: true });
  panZoom(view, r, input);
  Object.assign(input, { pressed: false, mouse: { x: 2250, y: 125 } });
  panZoom(view, r, input);
  assert.equal(view.ox, 0, 'a drag past the edge stops at the edge');
  for (let i = 0; i < 40; i += 1) panZoom(view, r, { ...input, down: false, scroll: 100, mouse: { x: 10, y: 10 } });
  assert.equal(view.zoom, MAX_ZOOM);
});

test('the country under a point comes from the Natural Earth outlines, and cities sit in theirs', async () => {
  const { countryAt } = await import('../src/windows/mapWorld.js');
  const { cities } = await import('../src/data/content.js');
  // the middle of the Atlantic is sea
  assert.equal(countryAt((-40 + 180) / 360, (90 - 30) / 180), null);
  const at = (name) => cities().find((c) => c.name === name);
  assert.equal(countryAt(at('PARIS').x, at('PARIS').y)?.code, 'FR');
  assert.equal(countryAt(at('TOKYO').x, at('TOKYO').y)?.code, 'JP');
  assert.equal(countryAt(at('NAIROBI').x, at('NAIROBI').y)?.code, 'KE');
});

test('the world keeps its shape in any box', async () => {
  const { worldFrame } = await import('../src/windows/mapWorld.js');
  for (const r of [{ x: 0, y: 0, w: 1000, h: 300 }, { x: 10, y: 20, w: 400, h: 600 }]) {
    const g = worldFrame(r);
    assert.ok(Math.abs(g.w / g.h - 2.5) < 1e-9, 'a 360 by 144 degree strip, never stretched');
    assert.ok(g.x >= r.x && g.y >= r.y && g.x + g.w <= r.x + r.w + 1e-9 && g.y + g.h <= r.y + r.h + 1e-9, 'inside the box');
  }
});

test('the city under the pointer lights up, with the rest of its country dimmer', async () => {
  const { hoverCities, cityHosts } = await import('../src/windows/mapWorld.js');
  const { cities } = await import('../src/data/content.js');
  const list = cities();
  const place = (c) => ({ x: c.x * 1000, y: c.y * 500 });
  const at = (name) => list.findIndex((c) => c.name === name);
  const paris = place(list[at('PARIS')]);
  assert.equal(hoverCities(paris.x + 3, paris.y, place, null).focus, at('PARIS'));
  const ny = place(list[at('NEW YORK')]);
  const lit = hoverCities(ny.x, ny.y, place, null);
  assert.equal(lit.focus, at('NEW YORK'));
  assert.ok(lit.siblings.includes(at('CHICAGO')) && lit.siblings.includes(at('MIAMI')), 'the other US cities');
  assert.ok(!lit.siblings.includes(at('TORONTO')), 'not Canada');
  // the mid-Atlantic is near no city
  assert.equal(hoverCities(0.39 * 1000, 0.33 * 500, place, null).focus, null);

  // only found machines are listed
  const g = makeGame('CITY', 7);
  const h = g.world.hosts.find((x) => x.company !== null && !x.discovered);
  assert.ok(h, 'a hidden host');
  assert.ok(!cityHosts(g, h.city).includes(h));
  h.discovered = true;
  assert.ok(cityHosts(g, h.city).includes(h));
});

test('picking a host in the list glides the map onto it', async () => {
  const { glideStep, camera } = await import('../src/windows/mapWorld.js');
  const state = mapState();
  const g = state.game;
  const hosts = mapHosts(g, state.win.map);
  const i = hosts.findIndex((h) => h.x > 0.6);
  handleEvents(state, [{ type: 'select', id: 'map.list', index: i }], DESK);
  drawPlay(stubCtx(), theme(), W, H, state, []);
  const view = state.win.map;
  assert.ok(view.goal, 'a glide is under way');
  for (let n = 0; n < 80; n += 1) glideStep(view);
  assert.equal(view.goal, null, 'and it ends');
  const c = camera(view);
  assert.ok(c.z >= 3, 'zoomed in');
  assert.ok(Math.abs(c.ox + 0.5 / c.z - hosts[i].x) < 0.01, 'the host is in the middle across');
});

test('the public machines are filed under the city nearest their pin', async () => {
  const { cities } = await import('../src/data/content.js');
  const g = makeGame('PUB', 7);
  for (const id of [g.world.nic, g.world.news, g.world.blackgate]) {
    const h = g.world.hosts[id];
    const near = cities().reduce((b, c, i) => ((c.x - h.x) ** 2 + (c.y - h.y) ** 2 < (cities()[b].x - h.x) ** 2 + (cities()[b].y - h.y) ** 2 ? i : b), 0);
    assert.equal(h.city, near, h.name);
  }
});

test('dragging the map moves the kept country drawing instead of redrawing it', async () => {
  stubCtx(); // gives node a document to make the kept canvas from
  const { countryLayer } = await import('../src/windows/mapWorld.js');
  const r = { x: 0, y: 0, w: 400, h: 200 };
  let paints = 0;
  const paint = () => { paints += 1; };
  const first = countryLayer(r, 'drag-test', { x: 100, y: 50 }, false, paint);
  assert.equal(paints, 1);
  const moved = countryLayer(r, 'drag-test', { x: 130, y: 40 }, true, paint);
  assert.equal(paints, 1, 'no redraw while dragging');
  assert.deepEqual([moved.dx, moved.dy], [30, -10], 'the drawing follows the drag');
  assert.equal(moved.canvas, first.canvas);
  countryLayer(r, 'drag-test', { x: 130, y: 40 }, false, paint);
  assert.equal(paints, 2, 'redrawn once the drag ends');
});
