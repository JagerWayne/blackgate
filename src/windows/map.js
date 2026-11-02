// NEXUS MAP: the world, the hosts on it and the route through them.
//
// Along the top: the search and the kind filters. On the left: the world. On
// the right, three tabs: HOSTS (the list and the picked host), ROUTE (the hop
// chain, each hop movable and removable) and SAVED (the kept routes).

import { drawFrame, splitPanel, detailPane, emptyNote } from '../ui/panel.js';
import { drawTable, flex } from '../ui/table.js';
import { drawField } from '../ui/field.js';
import { placeButtons } from '../ui/layout.js';
import { drawButton } from '../ui/widgets.js';
import { drawScrolled } from '../ui/scroll.js';
import { label, keyValue, chips, spacer, custom, meter, buttons as buttonRow } from '../ui/controls.js';
import { draw as drawText, ellipsize } from '../core/text.js';
import { color } from '../core/theme.js';
import { ghost, flat, primary, solid } from '../ui/styles.js';
import { guardTint } from '../ui/guard.js';
import { HOST_LABEL } from '../data/enums.js';
import { hint } from '../data/content.js';
import { FONT } from '../core/text.js';
import { routeFactor } from '../state/gameState.js';
import { hops as cleanHops } from '../state/gateway.js';
import { MAP_FILTERS, mapHosts, filterCount } from '../state/mapQuery.js';
import { savedRoutes, hopNumber, MAX_HOPS, MAX_ROUTES } from '../state/routes.js';
import { drawMapWorld, mapBtn } from './mapWorld.js';

/// The tabs on the right.
const TABS = ['HOSTS', 'ROUTE', 'SAVED'];

/// Draws the map window.
export function drawMap(ctx, sk, r, game, ui, input, events, view) {
  const hosts = mapHosts(game, view);
  const found = game.world.hosts.filter((h) => h.discovered).length;
  const route = game.player.bounce;
  const body = drawFrame(ctx, sk, r, ui, input, events, '', `${found} hosts found // ${hosts.length} shown // route ${route.length} of ${MAX_HOPS} hops`);

  const barH = drawToolbar(ctx, sk, body, game, ui, input, events, view);
  const rest = { x: body.x, y: body.y + barH + 8, w: body.w, h: Math.max(body.h - barH - 8, 60) };
  const [left, right] = splitPanel(rest, 0.58, 340);
  drawMapWorld(ctx, sk, left, game, view, input, new Set(hosts.map((h) => h.id)));

  // -- the tabs ------------------------------------------------------------------
  const tab = TABS.includes(view.tab) ? view.tab : 'HOSTS';
  const tw = Math.floor((right.w - 8) / 3);
  const saved = savedRoutes(game);
  const count = { HOSTS: hosts.length, ROUTE: route.length, SAVED: saved.length };
  TABS.forEach((t, i) => {
    const rr = { x: right.x + i * (tw + 4), y: right.y, w: tw, h: 28 };
    if (drawButton(ctx, ui, sk, `map.tab.${t}`, rr, `${t} ${count[t]}`, t === tab ? primary() : ghost(), input)) events.push({ type: 'click', id: `map.tab.${t}` });
  });
  const pane = { x: right.x, y: right.y + 36, w: right.w, h: Math.max(right.h - 36, 60) };
  if (tab === 'ROUTE') drawScrolled(ctx, sk, detailPane(ctx, sk, pane), routeControls(sk, game, view), 'map.route', ui, input, events);
  else if (tab === 'SAVED') drawSaved(ctx, sk, pane, game, saved, ui, input, events);
  else drawHosts(ctx, sk, pane, game, hosts, ui, input, events, view);
}

/// The HOSTS tab: the list, then the picked host's card.
function drawHosts(ctx, sk, right, game, hosts, ui, input, events, view) {
  const full = game.player.bounce.length >= MAX_HOPS;
  const detailH = Math.min(Math.max(right.h * 0.42, 170), 260);
  const list = { x: right.x, y: right.y, w: right.w, h: Math.max(right.h - detailH - 10, 60) };
  const rows = hosts.map((h) => {
    const hop = hopNumber(game, h.id);
    const cells = [
      { text: h.name, size: FONT.emphasis, color: sk.text_hi, col: 0, line: 0 },
      { text: h.ip, size: FONT.body, color: sk.accent, align: 'right', col: 1, line: 0 },
      { text: `${HOST_LABEL[h.kind] ?? ''}${ownerOf(game, h) ? ` // ${ownerOf(game, h)}` : ''}`, size: FONT.body, color: sk.dim, col: 0, line: 1 },
    ];
    if (hop) cells.push({ text: `HOP ${hop}`, size: FONT.body, color: sk.warn, align: 'right', col: 1, line: 1 });
    return {
      grid: true,
      cells,
      marker: game.favorites.includes(h.id) ? sk.warn : null,
      actions: [
        hop ? { id: `map.hop.${h.id}`, text: '-HOP', style: ghost() } : { id: `map.hop.${h.id}`, text: '+HOP', style: { ...ghost(), disabled: full } },
        { id: `map.go.${h.id}`, text: 'LINK', style: mapBtn() },
      ],
    };
  });
  // a host picked from elsewhere (SHOW TARGET, a pin) is scrolled into view
  if (view.follow) {
    const at = hosts.findIndex((h) => h.id === view.sel);
    if (at >= 0) ui.scroll.set('map.list', Math.max((at - 1) * 46, 0));
    view.follow = false;
  }
  drawTable(ctx, sk, list, {
    id: 'map.list',
    columns: [flex('HOST', 0.6), flex('ADDRESS', 0.4, 'right')],
    rows,
    selected: hosts.findIndex((h) => h.id === view.sel),
    rowH: 46,
    empty: view.query ? `nothing matches "${view.query}"` : 'nothing in this filter',
  }, ui, input, events);

  const pane = detailPane(ctx, sk, { x: right.x, y: list.y + list.h + 10, w: right.w, h: right.h - list.h - 10 });
  const picked = view.sel !== undefined && view.sel !== null ? game.world.hosts[view.sel] : null;
  if (!picked || !picked.discovered) {
    emptyNote(ctx, sk, pane, 'pick a host on the map or in the list');
    return;
  }
  drawScrolled(ctx, sk, pane, hostControls(sk, game, picked), 'map.host', ui, input, events);
}

/// The SAVED tab: each kept route with USE and DELETE.
function drawSaved(ctx, sk, box, game, saved, ui, input, events) {
  const rows = saved.map((s, i) => ({
    grid: true,
    cells: [
      { text: s.name, size: FONT.emphasis, color: sk.text_hi, col: 0, line: 0 },
      { text: `${s.hops.length} hops`, size: FONT.body, color: sk.dim, align: 'right', col: 1, line: 0 },
      { text: s.hops.map((id) => game.world.hosts[id]?.name ?? '?').join(' > '), size: FONT.body, color: sk.dim, col: 0, line: 1 },
    ],
    actions: [
      { id: `map.route.load.${i}`, text: 'USE', style: primary() },
      { id: `map.route.del.${i}`, text: 'DELETE', style: flat() },
    ],
  }));
  drawTable(ctx, sk, box, {
    id: 'map.routes',
    columns: [flex('SAVED ROUTE', 0.62), flex('HOPS', 0.38, 'right')],
    rows,
    rowH: 46,
    empty: `no routes kept yet // build one on the ROUTE tab and SAVE it (up to ${MAX_ROUTES})`,
  }, ui, input, events);
}

/// The search field and the filter buttons. Returns the height they took.
function drawToolbar(ctx, sk, body, game, ui, input, events, view) {
  const searchW = Math.min(Math.max(body.w * 0.3, 160), 300);
  const field = { x: body.x, y: body.y, w: searchW, h: 26 };
  const typed = drawField(ctx, ui, sk, 'map.search', field, view.query ?? '', 'search name, address, owner, kind', false, input);
  if (typed !== null) view.query = typed;
  if (ui.escFrom === 'map.search' || (ui.focus === 'map.search' && input.esc)) {
    view.query = '';
    ui.focus = null;
  }
  const active = view.kind ?? 'all';
  const items = MAP_FILTERS.map(([kind, name]) => {
    const n = filterCount(game, kind);
    const on = kind === active;
    const style = on ? ghost() : { ...flat(), disabled: n === 0 && kind !== 'all' };
    return { id: `map.k.${kind}`, text: `${name} ${n}`, style: { ...style, size: FONT.body, pad: 8 } };
  });
  const x0 = field.x + field.w + 10;
  const { placed, height } = placeButtons(ctx, x0, body.y, Math.max(body.x + body.w - x0, 60), items);
  placed.forEach((spot) => {
    const br = { x: spot.x, y: spot.y, w: spot.w, h: spot.h };
    if (drawButton(ctx, ui, sk, spot.item.id, br, spot.item.text, spot.item.style, input)) {
      events.push({ type: 'click', id: spot.item.id });
    }
  });
  return Math.max(height, field.h);
}

/// The route panel: the hops in order, what they buy, and the buttons that
/// keep the route for later.
function routeControls(sk, game, view) {
  const route = game.player.bounce;
  const clean = cleanHops(game.player.gateway);
  const pick = view.sel !== undefined && view.sel !== null ? game.world.hosts[view.sel] : null;
  const canAdd = pick?.discovered && !route.includes(pick.id) && route.length < MAX_HOPS;
  const controls = [
    label(`BOUNCE ROUTE // ${route.length} of ${MAX_HOPS} hops`, FONT.emphasis, sk.text_hi),
    label('each hop hides you behind another machine: a trace has to walk back through every one', FONT.body, sk.dim),
    spacer(6),
    keyValue('START', 'YOUR GATEWAY', sk.accent),
  ];
  route.forEach((id, i) => {
    const h = game.world.hosts[id];
    const ok = i < clean;
    controls.push(custom(46, (c, s, rr) => {
      c.fillStyle = color(s.panel2);
      c.fillRect(rr.x + 14, rr.y, rr.w - 14, 40);
      c.fillStyle = color(ok ? s.ok : s.danger);
      c.fillRect(rr.x + 14, rr.y, 4, 40);
      c.fillRect(rr.x + 5, rr.y - 6, 2, 52);
      drawText(c, `${i + 1}`, rr.x + 28, rr.y + 6, FONT.emphasis, color(ok ? s.ok : s.danger));
      drawText(c, ellipsize(c, h?.name ?? '?', FONT.emphasis, rr.w - 70), rr.x + 50, rr.y + 4, FONT.emphasis, color(s.text_hi));
      drawText(c, ellipsize(c, ok ? (h?.ip ?? '') : `${h?.ip ?? ''} // past your clean hops: slows the link`, FONT.body, rr.w - 70), rr.x + 50, rr.y + 22, FONT.body, color(ok ? s.dim : s.danger));
    }));
    controls.push(buttonRow([
      { id: `map.up.${i}`, text: 'UP', style: { ...flat(), disabled: i === 0 } },
      { id: `map.down.${i}`, text: 'DOWN', style: { ...flat(), disabled: i === route.length - 1 } },
      { id: `map.show.${id}`, text: 'SHOW', style: ghost() },
      { id: `map.hop.${id}`, text: 'REMOVE', style: flat() },
    ]));
  });
  if (!route.length) controls.push(label('no hops yet: links go straight from your gateway. Press +HOP on a host.', FONT.body, sk.warn));
  controls.push(keyValue('END', 'THE HOST YOU LINK TO', sk.accent));
  controls.push(spacer(6));
  controls.push(meter(`CLEAN HOPS ${Math.min(route.length, clean)} / ${clean}`, clean ? Math.min(route.length / clean, 1) : 1, route.length > clean ? sk.danger : sk.ok));
  controls.push(keyValue('TRACE SPEED', `${Math.round(routeFactor(game) * 100)}%`, sk.ok));
  controls.push(spacer(4));
  controls.push(buttonRow([
    { id: 'map.addsel', text: pick?.discovered ? `ADD ${pick.name}` : 'ADD PICKED HOST', style: { ...primary(), disabled: !canAdd } },
    { id: 'map.route.save', text: 'SAVE ROUTE', style: { ...primary(), disabled: !route.length || savedRoutes(game).length >= MAX_ROUTES } },
    { id: 'map.route.clear', text: 'CLEAR', style: { ...ghost(), disabled: !route.length } },
  ]));
  if (route.length && savedRoutes(game).length >= MAX_ROUTES) controls.push(label(hint('routesFull'), FONT.body, sk.warn));
  return controls;
}

/// The picked host: what it is, who owns it, and what can be done with it.
function hostControls(sk, game, h) {
  const hop = hopNumber(game, h.id);
  const fav = game.favorites.includes(h.id);
  const full = game.player.bounce.length >= MAX_HOPS;
  const marks = [];
  if (fav) marks.push(['FAVOURITE', sk.warn]);
  if (hop) marks.push([`HOP ${hop}`, sk.warn]);
  const controls = [
    label(h.name, FONT.heading, sk.text_hi),
    label(`${HOST_LABEL[h.kind] ?? ''} // ${h.ip}`, FONT.body, sk.dim),
  ];
  if (marks.length) controls.push(chips(marks));
  controls.push(keyValue('OWNER', ownerOf(game, h) || 'INDEPENDENT', sk.text));
  controls.push(keyValue('GUARD', `FW ${h.firewall} / MON ${h.monitor} / PX ${h.proxy}`, guardTint(sk, h)));
  controls.push(spacer(6));
  controls.push(buttonRow([
    { id: `map.go.${h.id}`, text: 'LINK', style: { ...solid(), isDefault: true } },
    hop
      ? { id: `map.hop.${h.id}`, text: 'REMOVE FROM ROUTE', style: ghost() }
      : { id: `map.hop.${h.id}`, text: 'ADD TO ROUTE', style: { ...primary(), disabled: full } },
    { id: `map.fav.${h.id}`, text: fav ? 'UNFAVOURITE' : 'FAVOURITE', style: ghost() },
  ]));
  // a route holds eight hops at most: the button says so instead of doing nothing
  if (full && !hop) controls.push(label(hint('routeFull'), FONT.body, sk.warn));
  return controls;
}

/// The name of the company that owns a host, or '' for an independent one.
function ownerOf(game, h) {
  return h.company !== null && h.company !== undefined ? game.world.companies[h.company]?.name ?? '' : '';
}
