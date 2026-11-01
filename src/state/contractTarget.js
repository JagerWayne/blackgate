// Picking the target a job is done on.

import { range } from '../core/rng.js';
import { storage } from './gateway.js';
import { storageUsed } from './gameHelpers.js';
import { recordsKept } from './records.js';

/// The hosts a kind of work can be done on.
function hostKinds(kind) {
  if (kind === 'transfer') return ['bank'];
  if (kind === 'model') return ['aiLab'];
  return ['corporate', 'bank', 'gov', 'aiLab', 'datacenter'];
}

/// The guard a target may have for the operator's rating: a new operator is
/// only given hosts with no firewall, monitor or proxy. The hardened hosts
/// come with the rating that unlocks the heavy work.
function guardCap(game) {
  if (game.player.rating < 8) return { firewall: 0, monitor: 0, proxy: 0 };
  return { firewall: 6, monitor: 6, proxy: 5 };
}

/// The room left on the gateway's drives, in GB.
export function freeSpace(game) {
  return Math.max(storage(game.player.gateway) - storageUsed(game), 0);
}

/// Picks a target the operator can actually carry out the job on.
export function pickTarget(game, kind, opts = {}) {
  const candidates = targetsFor(game, kind, opts);
  if (!candidates.length) return null;
  return { target: candidates[range(game.rng, 0, candidates.length)], free: freeSpace(game) };
}

/// The hosts a job of a kind could go to. `only` keeps one host; `anyGuard`
/// lets a cheat aim past the guard the rating allows.
export function targetsFor(game, kind, { only = null, anyGuard = false } = {}) {
  const free = freeSpace(game);
  const cap = guardCap(game);
  return game.world.hosts
    .filter((h) => h.company !== null && h.company !== undefined)
    .filter((h) => only === null || h.id === only)
    .filter((h) => hostKinds(kind).includes(h.kind))
    .filter((h) => anyGuard || (h.firewall <= cap.firewall && h.monitor <= cap.monitor && h.proxy <= cap.proxy))
    .filter((h) => {
      // the job names a file the operator can take: it has to be there, plain,
      // and small enough for the gateway
      if (kind === 'retrieve') {
        return h.files.some((f) => !f.deleted && f.tag === 0 && f.enc === 0 && f.size <= free);
      }
      if (kind === 'delete') {
        return h.files.some((f) => !f.deleted && f.tag === 0);
      }
      // an alteration needs a host that keeps the records
      if (kind === 'modify') return recordsKept(game, h).length > 0;
      if (kind === 'destroy') {
        // sabotage has to have something to burn
        return h.files.some((f) => !f.deleted);
      }
      return true;
    })
    .map((h) => h.id);
}
