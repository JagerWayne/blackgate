// The cheat menu's rules: money, heat, the clock, the rating and the switches
// behind the BLACKGATE logo. The run is not marked for using them.

import { advance, SECONDS_PER_MINUTE } from '../core/clock.js';
import { heatTick } from '../systems/heatTick.js';
import { software, chassis, componentsOf } from '../data/content.js';
import { adjust, toast, note } from './gameHelpers.js';
import { slotsFor } from './gateway.js';
import { HW_KINDS, RATING_MAX } from '../data/enums.js';
import { onMinutes } from '../systems/clockTick.js';

/// The clock speeds the operator can pick.
export const SPEEDS = [1, 2, 4, 8, 16];

/// The hottest the menu will set the heat: a raid starts at 100.
const HEAT_MAX = 99;

/// The time skips, in minutes.
export const SKIPS = [60, 360, 1440];

/// The cheat switches of a run, filled in for a run saved before them.
export function cheatsOf(game) {
  game.cheats = { freezeHeat: null, freezeTrace: false, ...(game.cheats ?? {}) };
  return game.cheats;
}

/// How fast the world clock runs. A run saved before the speeds keeps its
/// fast-forward box.
export function timeScale(game) {
  // the Red countdown runs in real time
  if (game.raid) return 1;
  const s = game.settings;
  if (SPEEDS.includes(s.timeScale)) return s.timeScale;
  return s.fastForward ? 8 : 1;
}

/// Sets the clock speed; the old fast-forward box follows it.
export function setTimeScale(game, scale) {
  if (!SPEEDS.includes(scale)) return;
  game.settings.timeScale = scale;
  game.settings.fastForward = scale > 1;
}

/// The next speed up, round to the start again.
export function nextSpeed(game) {
  const at = SPEEDS.indexOf(timeScale(game));
  return SPEEDS[(at + 1) % SPEEDS.length];
}

// -- money ----------------------------------------------------------------------

/// Adds (or, below zero, takes) money.
export function addMoney(game, amount) {
  return adjust(game, amount, 'cheat');
}

/// Sets the money to an exact figure. A figure that is not a whole number of
/// credits changes nothing. Returns whether it was set.
export function setMoney(game, text) {
  const clean = String(text ?? '').replace(/[,\s]/g, '');
  const value = Number(clean);
  if (clean === '' || !Number.isFinite(value) || value < 0) return false;
  adjust(game, Math.round(value) - game.player.credits, 'cheat');
  return true;
}

// -- heat -----------------------------------------------------------------------

const clampHeat = (v) => Math.min(Math.max(Math.round(v), 0), HEAT_MAX);

/// Sets the heat. A frozen heat is held at the new figure.
export function setHeat(game, value) {
  game.player.heat = clampHeat(value);
  const c = cheatsOf(game);
  if (c.freezeHeat !== null) c.freezeHeat = game.player.heat;
}

/// Moves the heat up or down.
export function nudgeHeat(game, by) {
  setHeat(game, game.player.heat + by);
}

/// Holds the heat where it is, or lets it go.
export function toggleFreezeHeat(game) {
  const c = cheatsOf(game);
  c.freezeHeat = c.freezeHeat === null ? clampHeat(game.player.heat) : null;
}

/// The frozen heat, put back after the world moved it. Runs before the raid
/// check, so a frozen heat never raids.
export function holdHeat(game) {
  const held = game.cheats?.freezeHeat;
  if (held !== null && held !== undefined) game.player.heat = held;
}

// -- time -----------------------------------------------------------------------

/// Runs the clock forward, a minute at a time so every minute's work is done
/// (deadlines, offers, the board, the wire). Not while a link is open: the
/// trace would jump with it.
export function skipTime(game, minutes) {
  if (game.session) {
    toast(game, 'Close the link before skipping time', 'bad');
    return false;
  }
  for (let i = 0; i < minutes && !game.gameOver; i += 1) {
    advance(game.clock, 1);
    onMinutes(game, 1);
  }
  // the heat cools over the skipped time as it would have while waiting
  heatTick(game, minutes * SECONDS_PER_MINUTE);
  note(game, `clock skipped ${minutes} minutes`);
  return true;
}

// -- rating ---------------------------------------------------------------------

/// Moves the rating within its bounds.
export function nudgeRating(game, by) {
  game.player.rating = Math.min(Math.max(game.player.rating + by, 0), RATING_MAX);
}

// -- the switches -----------------------------------------------------------------

/// Holds the trace of a live link where it is, or lets it go.
export function toggleFreezeTrace(game) {
  const c = cheatsOf(game);
  c.freezeTrace = !c.freezeTrace;
}

/// Puts every machine on the map.
export function revealMap(game) {
  game.world.hosts.forEach((h) => {
    h.discovered = true;
  });
}

/// Installs every tool at its top version.
export function maxTools(game) {
  software().forEach((s) => {
    const top = s.versions?.length || 5;
    const have = game.player.tools.find((t) => t.kind === s.kind);
    if (have) have.level = Math.max(have.level, top);
    else game.player.tools.push({ kind: s.kind, level: top });
  });
}

/// The best chassis, every slot filled with the best part, and no downtime.
export function maxGateway(game) {
  const g = game.player.gateway;
  g.chassis = Math.max(...chassis().map((c) => c.tier));
  g.migrateUntil = 0;
  g.parts = [];
  const rack = chassis().find((c) => c.tier === g.chassis).rack;
  HW_KINDS.forEach((kind) => {
    const best = componentsOf(kind).filter((d) => !d.needs_rack || rack).reduce((a, b) => (b.tier > a.tier ? b : a));
    for (let i = 0; i < slotsFor(g, kind); i += 1) {
      g.parts.push({ kind, level: best.tier, name: best.name });
    }
  });
}
