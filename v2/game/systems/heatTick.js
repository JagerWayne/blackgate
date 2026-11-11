// Heat and the raid: the evidence that piles up against the operator, and what
// the security units do when it reaches the end.

import { failsafe, ownFailsafe, raidShield } from '../state/gateway.js';
import { note } from '../state/gameState.js';
import { holdHeat } from '../state/cheats.js';
import { band, beginRaid, raidCountdown, resetRig } from './physical.js';

/// The heat on the operator, and the raid when it is full. With the
/// perimeter sensors the raid is first a 15-second Red countdown.
export function heatTick(game, dt) {
  if (!game.session && !game.raid) {
    game.player.heat = Math.max(game.player.heat - dt * 0.12, 0);
  }
  // a heat frozen from the cheat menu is put back before the raid check
  holdHeat(game);
  if (game.raid) {
    if (raidCountdown(game, dt)) raid(game);
    return;
  }
  if (game.player.heat >= 100 && beginRaid(game)) raid(game);
  announce(game);
}

/// The sensors say so when the band changes to Yellow or Red.
function announce(game) {
  const now = band(game);
  if (now === game.band) return;
  game.band = now;
  if (now === 'yellow') game.toasts.push({ text: 'Perimeter sensors: unmarked vehicles near the hideout', kind: 'bad', born: game.uiTime });
  if (now === 'red') game.toasts.push({ text: 'Perimeter sensors: BREACH IN PROGRESS', kind: 'bad', born: game.uiTime });
}

/// A raid reached the machine.
export function raid(game) {
  // a security failsafe answers the raid; otherwise the shield goes first and
  // the chassis purge is the last resort
  const shield = ownFailsafe(game.player.gateway) ? 0 : Math.min(Math.max(raidShield(game.player.gateway), 0), 0.95);
  if (shield > 0) {
    game.player.heat = 100 - shield * 100;
    note(game, `raid // protection absorbed ${Math.round(shield * 100)}% of the search`);
    game.toasts.push({
      text: `Raid // protection absorbed ${Math.round(shield * 100)}%`,
      kind: 'info',
      born: game.uiTime,
    });
    if (game.player.heat < 100) return;
  }
  switch (failsafe(game.player.gateway)) {
    // the charge burns the rig and every file: the warrant is void and the
    // operator starts again on a field rig, with the credits and the tools
    case 'PURGE': {
      const lost = game.player.storage.length;
      resetRig(game);
      note(game, 'raid // thermite fired // the rig is ash and the warrant is void');
      game.toasts.push({ text: `Raid // rig destroyed, ${lost} staged files burned`, kind: 'bad', born: game.uiTime });
      break;
    }
    // the decoy system answers the search team's questions
    case 'DECOY':
      game.player.heat = 0;
      note(game, 'raid // decoy system mounted // the search found nothing');
      game.toasts.push({ text: 'Raid // decoy OS mounted', kind: 'good', born: game.uiTime });
      break;
    // the emp cell takes the trace with it
    case 'EMP':
      game.player.heat = 0;
      if (game.session) {
        game.session.trace = 0;
        game.session.alerted = false;
        game.session.warned = false;
      }
      note(game, 'raid // local emp // every trace gone');
      game.toasts.push({ text: 'Raid // emp cell fired', kind: 'good', born: game.uiTime });
      break;
    default:
      game.gameOver = 'raided';
      break;
  }
}
