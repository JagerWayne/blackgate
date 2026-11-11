// Picking the target a job is done on.

import { range } from '../core/rng.js';
import { unlocks } from '../data/content.js';
import { authOf, AUTH_LEVEL } from '../data/auth.js';
import { isInternal } from '../data/network.js';
import { storage } from './gateway.js';
import { downloadFree } from './gameHelpers.js';
import { recordsKept } from './records.js';

/// The hosts a kind of work can be done on.
function hostKinds(kind) {
  if (kind === 'transfer') return ['bank'];
  if (kind === 'model') return ['aiLab'];
  return ['corporate', 'bank', 'gov', 'aiLab', 'datacenter'];
}

/// The guard a target may have for the operator's rating: a new operator is
/// only given hosts with no firewall, monitor or proxy. After that the world
/// holds what the versions the rating has unlocked can beat (version n beats
/// guard n).
function guardCap(game) {
  const rating = game.player.rating;
  const open = unlocks();
  const level = rating < open[1].rating ? 0 : open.filter((u) => rating >= u.rating).length;
  return { firewall: level, monitor: level, proxy: level };
}

/// Whether the records lock of a host is behind a guard the rating can beat:
/// app MFA wants the second unlock level (the hijacker v1), session-bound MFA
/// the third (v2) and a hardware token the fourth (the HSM tap).
function authReachable(game, h) {
  const records = h.services.find((v) => v.kind === 'records');
  const unlocked = unlocks().filter((u) => game.player.rating >= u.rating).length;
  return !records || unlocked >= AUTH_LEVEL[authOf(records)] + 1;
}

/// The biggest file a retrieve job may name: the first jobs are files the field
/// rig copies in a few seconds, and the big ones come with rating 6.
export function fileLimit(game) {
  return game.player.rating < unlocks()[1].rating ? 20 : Infinity;
}

/// The room left on the gateway's drives, in GB.
export function freeSpace(game) {
  return Math.max(downloadFree(game), 0);
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
    // an internal segment is reached with a forged ticket: from the third unlock level on
    .filter((h) => anyGuard || !isInternal(h) || unlocks().filter((u) => game.player.rating >= u.rating).length >= 3)
    .filter((h) => {
      // the job names a file the operator can take: it has to be there, plain,
      // and small enough for the gateway
      if (kind === 'retrieve') {
        return h.files.some((f) => !f.deleted && f.tag === 0 && f.enc === 0 && f.size <= Math.min(free, fileLimit(game)));
      }
      if (kind === 'delete') {
        return h.files.some((f) => !f.deleted && f.tag === 0);
      }
      // an alteration needs a host that keeps the records
      if (kind === 'modify') return recordsKept(game, h).length > 0 && (anyGuard || authReachable(game, h));
      if (kind === 'destroy') {
        // sabotage has to have something to burn
        return h.files.some((f) => !f.deleted);
      }
      return true;
    })
    .map((h) => h.id);
}
