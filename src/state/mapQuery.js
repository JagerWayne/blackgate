// Which hosts the NEXUS MAP shows: the kind filter and the search text.

import { HOST_LABEL } from '../data/enums.js';

/// The filters, in the order the map offers them: every host kind, then the
/// operator's own marks.
export const MAP_FILTERS = [
  ['all', 'ALL'],
  ['relay', 'RELAY'],
  ['public', 'PUBLIC'],
  ['corporate', 'CORPORATE'],
  ['bank', 'FINANCIAL'],
  ['gov', 'GOVERNMENT'],
  ['aiLab', 'AI CLUSTER'],
  ['router', 'ROUTER'],
  ['datacenter', 'DATACENTER'],
  ['fav', 'FAVOURITES'],
  ['route', 'IN ROUTE'],
];

/// Does a host pass a kind filter?
export function passesKind(game, h, kind) {
  if (!kind || kind === 'all') return true;
  if (kind === 'fav') return game.favorites.includes(h.id);
  if (kind === 'route') return game.player.bounce.includes(h.id);
  return h.kind === kind;
}

/// Does a host match the search text? The text is looked for in the name,
/// the address, the owner and the kind.
export function passesQuery(game, h, query) {
  const q = (query ?? '').trim().toLowerCase();
  if (!q) return true;
  const owner = h.company !== null && h.company !== undefined ? game.world.companies[h.company]?.name ?? '' : '';
  return [h.name, h.ip, owner, HOST_LABEL[h.kind] ?? ''].some((s) => s.toLowerCase().includes(q));
}

/// The known hosts the map shows for a view, sorted by name.
export function mapHosts(game, view) {
  return game.world.hosts
    .filter((h) => h.discovered)
    .filter((h) => passesKind(game, h, view.kind) && passesQuery(game, h, view.query))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
}

/// How many known hosts a filter holds, ignoring the search text.
export function filterCount(game, kind) {
  return game.world.hosts.filter((h) => h.discovered && passesKind(game, h, kind)).length;
}
