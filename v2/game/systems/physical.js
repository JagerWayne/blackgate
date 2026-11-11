// The physical trace: the sensor bands, the Red countdown and the ways out of
// an investigation. Heat stays the one number underneath; the bands are how the
// perimeter sensors show it.

import { chassisOf, hasSensors, hasJammer, starterParts } from '../state/gateway.js';
import { evaluateMissions } from '../state/contracts.js';
import { note } from '../state/gameState.js';

/// The heat at which the sensors turn Yellow.
const YELLOW_AT = 70;

/// The real seconds the Red countdown runs, and what the RF jammer adds.
const RED_SECS = 15;
const JAM_SECS = 45;

/// After a jammed raid, the game minutes in which every link leaves twice the heat.
const RF_MINUTES = 360;

/// A relocation: the minutes on the road and the minutes before the next.
const DRIVE_MINUTES = 120;
const DRIVE_COOLDOWN = 1440;

/// Green, Yellow or Red as the perimeter sensors show it; null without them.
export function band(game) {
  if (!hasSensors(game.player.gateway)) return null;
  if (game.raid) return 'red';
  return game.player.heat >= YELLOW_AT ? 'yellow' : 'green';
}

/// The raid is at the door. Without sensors there is no warning and it lands
/// at once (returns true); with them the Red countdown starts (returns false).
export function beginRaid(game) {
  const g = game.player.gateway;
  if (!hasSensors(g)) return true;
  game.raid = { left: RED_SECS };
  note(game, 'perimeter sensors // RED // tactical breach in progress');
  if (hasJammer(g)) {
    game.raid.left += JAM_SECS;
    game.player.rfUntil = game.clock.minutes + RF_MINUTES;
    note(game, 'rf jammer // the countdown is stretched');
  }
  return false;
}

/// Runs the countdown. True when it has run out: the raid lands.
export function raidCountdown(game, dt) {
  game.raid.left -= dt;
  if (game.raid.left > 0) return false;
  game.raid = null;
  return true;
}

/// How much heat a link leaves, as a multiple: twice while the RF jammer's
/// signature lingers.
export function heatGain(game) {
  return (game.player.rfUntil ?? 0) > game.clock.minutes ? 2 : 1;
}

/// Burns every file on the drives. A job that was waiting on one goes back to
/// being worked on.
export function wipeStorage(game) {
  game.player.storage = [];
  game.contracts.forEach((c) => {
    if (c.state === 'ready' && (c.kind === 'retrieve' || c.kind === 'model')) c.state = 'accepted';
  });
  evaluateMissions(game);
}

/// The thermite melt: the rig goes back to the Micro PC with one
/// compute part, the drives are empty and the warrant is void. Credits, tools,
/// stock and the world are kept.
export function resetRig(game) {
  const gw = game.player.gateway;
  game.player.gateway = { chassis: 1, board: 1, ip: gw.ip, migrateUntil: 0, parts: starterParts() };
  wipeStorage(game);
  game.player.heat = 0;
}

/// Why the Van cannot drive away now, or null when it can.
export function relocateError(game) {
  const g = game.player.gateway;
  if (!chassisOf(g).mobile) return 'only the Mobile C2 Van can move';
  if (game.session) return 'close the link first';
  if (game.raid) return 'too late to drive: the breach is under way';
  if (game.player.heat < YELLOW_AT) return 'no investigation to escape';
  if ((game.player.relocatedAt ?? -DRIVE_COOLDOWN) + DRIVE_COOLDOWN > game.clock.minutes) return 'the Van moves once a day';
  return null;
}

/// Drives the Van to a new grid: the investigation loses the trail (the heat
/// goes to 0) and the rig is on the road for two hours. Returns why it cannot.
export function relocate(game) {
  const why = relocateError(game);
  if (why) return why;
  const g = game.player.gateway;
  game.player.relocatedAt = game.clock.minutes;
  game.player.heat = 0;
  g.migrateUntil = game.clock.minutes + DRIVE_MINUTES;
  note(game, 'the Van moved to a new grid // the investigation lost the trail');
  return null;
}
