// The bounce route and the routes the operator keeps for later. A route is
// the list of host ids a link hops through before it reaches its target.

/// The most hops a route may have, and the most routes that can be kept.
export const MAX_HOPS = 8;
export const MAX_ROUTES = 6;

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
  if (routes.length >= MAX_ROUTES) return `only ${MAX_ROUTES} routes can be kept`;
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
  const hops = r.hops.filter((id) => game.world.hosts[id]?.discovered).slice(0, MAX_HOPS);
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
