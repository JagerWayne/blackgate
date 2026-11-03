// Internal networks: which hosts of a company sit behind its front, and how far
// the mapper and the forger of each version reach. Pure rules over the world, so
// the generator and a loaded old save agree (no random draws).

import { authOf, AUTH_LEVEL } from './auth.js';

/// How hard a host is: its three guards added.
export function difficultyOf(h) { return h.firewall + h.monitor + h.proxy; }

/// Whether a host is an internal segment: it cannot be linked from outside.
export function isInternal(h) { return h.internal === true; }

/// The host difficulty the zero-trust mapper and the Kerberos forger reach, by version.
export const REACH = { 1: 6, 2: 10, 3: 15 };

/// The difficulty from which the last host of a company is an internal segment:
/// a company of open hosts has no inside to hide.
const INTERNAL_FROM = 3;

/// Marks the crown host (the last) of every company that guards it.
export function markInternal(world) {
  world.companies.forEach((c) => {
    const crown = world.hosts[c.hosts.at(-1)];
    if (c.hosts.length >= 2 && crown && difficultyOf(crown) >= INTERNAL_FROM) crown.internal = true;
  });
}

/// The hosts of the company a host belongs to (none for a public host).
export function companyHosts(world, h) {
  return (world.companies[h.company]?.hosts ?? []).map((id) => world.hosts[id]);
}

/// The locked services a service-account key or a kernel exploit of a version
/// reaches: version 1 the plain password locks, 2 also app MFA, 3 also
/// session-bound MFA. A hardware token wants the HSM tap, not a key.
export function keyLocks(h, level) {
  return h.services.filter((v) => !v.open && v.kind !== 'voice' && authOf(v) !== 'token' && AUTH_LEVEL[authOf(v)] <= level - 1);
}
