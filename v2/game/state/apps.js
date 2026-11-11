// The room the installed software takes on the gateway. A tool's footprint
// grows with its version, and an upgrade replaces the old version's footprint
// rather than adding to it.

import { software } from '../data/content.js';

/// The footprint of a tool's first version, per point of its cpu cost, and how much
/// of that each later version adds. All tools at their top version come to about 500 GB,
/// so a 512 GB system drive holds every app with room for the system.
export const SIZE_BASE = 6.5;
export const SIZE_STEP = 1.3;

/// The GB an installed tool takes at a level (0 when it is not installed).
export function toolSize(kind, level) {
  if (!level) return 0;
  const def = software().find((d) => d.kind === kind);
  return Math.max(Math.round((def?.cpu ?? 1) * SIZE_BASE * (1 + SIZE_STEP * (level - 1))), 1);
}

/// The GB all installed tools take together.
export function appsUsed(game) {
  return game.player.tools.reduce((n, t) => n + toolSize(t.kind, t.level), 0);
}
