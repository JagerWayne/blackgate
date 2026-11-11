// The daily world: the same seed and modifier for everyone on a given date.

import { MODS } from './perks.js';

/// The seed of a date (yyyy-mm-dd): a small string hash.
export function dailySeed(date = new Date()) {
  const day = date.toISOString().slice(0, 10);
  let h = 2166136261;
  for (const ch of day) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h % 2 ** 31;
}

/// The modifier of a daily seed.
export const dailyMod = (seed) => MODS[seed % MODS.length];
