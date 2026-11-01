// NEXUS MAP: the world, the hosts on it and the route through them.
//
// Along the top: the search and the kind filters. On the left: the world, the
// bounce route, and the routes kept for later. On the right: the hosts the
// filters let through, and the one that is picked.

import { drawFrame, splitPanel, detailPane, emptyNote } from '../ui/panel.js';
import { drawTable, flex } from '../ui/table.js';
import { drawField } from '../ui/field.js';
import { placeButtons, measureControls } from '../ui/layout.js';
import { drawButton } from '../ui/widgets.js';
import { drawScrolled } from '../ui/scroll.js';
import { label, keyValue, chips, section, spacer, buttons as buttonRow } from '../ui/controls.js';
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

/// Draws the map window.
export function drawMap(ctx, sk, r, game, ui, input, events, view) {
  const hosts = mapHosts(game, view);
  const found = game.world.hosts.filter((h) => h.discovered).length;
  const route = game.player.bounce;
  const body = drawFrame(ctx, sk, r, ui, input, events, '', `${found} hosts found // ${hosts.length} shown // route ${route.length} of ${MAX_HOPS} hops`);

  const barH = drawToolbar(ctx, sk, body, game, ui, input, events, view);
  const rest = { x: body.x, y: body.y + barH + 8, w: body.w, h: Math.max(body.h - barH - 8, 60) };
  const [left, right] = splitPanel(rest, 0.58, 320);

  // -- the left: the world, the route on it, and the routes kept for later ----
  // the route panel is as tall as what it holds, so its buttons never scroll
  const routeList = routeControls(sk, game);
  const routeH = Math.min(measureControls(ctx, routeList, Math.max(left.w - 18, 40)) + 20, Math.max(left.h * 0.45, 140));
  const savedH = Math.min(Math.max(left.h * 0.24, 120), 200);
  const world = { x: left.x, y: left.y, w: left.w, h: Math.max(left.h - routeH - savedH - 20, 80) };
  drawMapWorld(ctx, sk, world, game, view, input, new Set(hosts.map((h) => h.id)));
  const routeBox = detailPane(ctx, sk, { x: left.x, y: world.y + world.h + 10, w: left.w, h: routeH });
  drawScrolled(ctx, sk, routeBox, routeList, 'map.route', ui, input, events);

  // the routes kept for later, one line each with their own buttons
  const savedBox = detailPane(ctx, sk, { x: left.x, y: routeBox.y + routeH + 10, w: left.w, h: savedH });
  const saved = savedRoutes(game);
  const savedRows = saved.map((s, i) => ({
    grid: true,
    cells: [
      { text: s.name, size: FONT.emphasis, color: sk.text_hi, col: 0, line: 0 },
      { text: `${s.hops.length} hops`, size: FONT.body, color: sk.dim, align: 'right', col: 1, line: 0 },
      { text: s.hops.map((id) => game.world.hosts[id]?.name ?? '?').join(' > '), size: FONT.body, color: sk.dim, col: 0, line: 1 },
    ],
    actions: [
      { id: `map.route.load.${i}`, text: 'USE', style: ghost() },
      { id: `map.route.del.${i}`, text: 'DELETE', style: flat() },
    ],
  }));
  drawTable(ctx, sk, savedBox, {
    id: 'map.routes',
    columns: [flex('SAVED ROUTE', 0.62), flex('HOPS', 0.38, 'right')],
    rows: savedRows,
    rowH: 40,
    empty: 'no routes kept yet',
  }, ui, input, events);

  // -- the right: the list over the picked host --------------------------------
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
      actions: [{ id: `map.go.${h.id}`, text: 'LINK', style: mapBtn() }],
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
function routeControls(sk, game) {
  const route = game.player.bounce;
  const clean = cleanHops(game.player.gateway);
  const controls = [label(`BOUNCE ROUTE // ${route.length} of ${MAX_HOPS} hops`, FONT.emphasis, sk.text_hi)];
  if (!route.length) {
    controls.push(label('no hops: links go straight from your gateway', FONT.body, sk.dim));
  } else {
    // a hop past the gateway's clean hops slows the link down
    controls.push(chips(route.map((id, i) => [`${i + 1} ${game.world.hosts[id]?.name ?? '?'}`, i < clean ? sk.warn : sk.danger])));
  }
  controls.push(keyValue('CLEAN HOPS', `${clean} on this gateway`, route.length > clean ? sk.danger : sk.text));
  controls.push(keyValue('TRACE SPEED', `${Math.round(routeFactor(game) * 100)}%`, sk.ok));
  controls.push(spacer(4));
  controls.push(buttonRow([
    { id: 'map.route.save', text: 'SAVE ROUTE', style: { ...primary(), disabled: !route.length || savedRoutes(game).length >= MAX_ROUTES } },
    { id: 'map.route.clear', text: 'CLEAR', style: { ...ghost(), disabled: !route.length } },
  ]));
  // a full book of routes says so, instead of a button that does nothing
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
