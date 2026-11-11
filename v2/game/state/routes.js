// The bounce route and the routes the operator keeps for later. A route is
// the list of host ids a link hops through before it reaches its target.

import { hops } from './gateway.js';
import { maxRoutes, minHopLimit } from '../data/settings.js';

/// The most hops any route may have at least, and the most routes that can be kept.

/// The most hops a route may have: eight, or as many as the network cards carry.
export function maxHops(game) {
  return Math.max(minHopLimit(), hops(game.player.gateway));
}

/// The kept routes. A run saved before routes existed has none.
export function savedRoutes(game) {
  if (!Array.isArray(game.routes)) game.routes = [];
  return game.routes;
}

/// Keeps the current route under the next free name. Returns an error, or
/// null when it was kept.
export function saveRoute(game) {
  const hops = game.player.bounce;
  const routes = savedRoutes(game);
  if (!hops.length) return 'the route has no hops';
  if (routes.length >= maxRoutes()) return `only ${maxRoutes()} routes can be kept`;
  if (routes.some((r) => sameHops(r.hops, hops))) return 'that route is already kept';
  const used = new Set(routes.map((r) => r.name));
  let n = 1;
  while (used.has(`ROUTE ${n}`)) n += 1;
  routes.push({ name: `ROUTE ${n}`, hops: hops.slice() });
  return null;
}

/// Makes a kept route the current one. Hops the map no longer knows are left
/// out. Returns an error, or null.
export function loadRoute(game, index) {
  const r = savedRoutes(game)[index];
  if (!r) return 'no such route';
  const hops = r.hops.filter((id) => game.world.hosts[id]?.discovered).slice(0, maxHops(game));
  game.player.bounce.splice(0, game.player.bounce.length, ...hops);
  return null;
}

/// Forgets a kept route.
export function deleteRoute(game, index) {
  const routes = savedRoutes(game);
  if (index >= 0 && index < routes.length) routes.splice(index, 1);
}

/// Empties the current route.
export function clearRoute(game) {
  game.player.bounce.splice(0, game.player.bounce.length);
}

/// Where a host sits in the current route, from 1, or 0 when it is not in it.
export function hopNumber(game, id) {
  return game.player.bounce.indexOf(id) + 1;
}

function sameHops(a, b) {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/// Moves the hop at `index` one place up (-1) or down (+1). False when it cannot.
export function moveHop(game, index, dir) {
  const b = game.player.bounce;
  const to = index + dir;
  if (index < 0 || index >= b.length || to < 0 || to >= b.length) return false;
  [b[index], b[to]] = [b[to], b[index]];
  return true;
}
