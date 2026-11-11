// Host traits: a known quirk on the harder hosts, shown in the TARGET block so
// the operator can plan around it. A host's trait comes from its id, so it is
// the same every run of the same world and needs no save field.
// shortcut: three traits in code, not data; move to data/ when there are more.

import { difficultyOf } from './network.js';
import { MINUTES_PER_DAY } from '../core/clock.js';

/// The hardness from which a host gets a trait.
const TRAIT_FROM = 5;

export const TRAITS = {
  honeypot: { label: 'HONEYPOT', note: 'a copied file raises the alarm' },
  nightshift: { label: 'NIGHT SHIFT', note: 'the trace runs faster from 22:00 to 06:00' },
  paranoid: { label: 'PARANOID', note: 'the trace starts the moment the link is up' },
};
const ORDER = Object.keys(TRAITS);

/// The trait id of a host, or null.
export function traitOf(h) {
  if (!h || difficultyOf(h) < TRAIT_FROM) return null;
  return ORDER[Number(h.id) % ORDER.length] ?? null;
}

/// Is it night on this clock (minutes since the start)?
export function isNight(minutes) {
  const hour = (minutes % MINUTES_PER_DAY) / 60;
  return hour >= 22 || hour < 6;
}
