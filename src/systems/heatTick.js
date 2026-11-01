// Heat and the raid: the evidence that piles up against the operator, and what
// the security units do when it reaches the end.

import { failsafe, ownFailsafe, raidShield } from '../state/gateway.js';
import { note } from '../state/gameState.js';
import { holdHeat } from '../state/cheats.js';

/// The heat on the operator, and the raid when it is full.
export function heatTick(game, dt) {
  if (!game.session) {
    game.player.heat = Math.max(game.player.heat - dt * 0.12, 0);
  }
  // a heat frozen from the cheat menu is put back before the raid check
  holdHeat(game);
  if (game.player.heat >= 100) raid(game);
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
    // the injector burns every drive and every buffer: the hardware is lost,
    // the operator is not
    case 'PURGE': {
      const lost = game.player.storage.length;
      game.player.storage = [];
      game.player.heat = 45;
      note(game, 'raid // thermite injector fired // storage destroyed');
      game.toasts.push({ text: `Raid // ${lost} staged files burned`, kind: 'bad', born: game.uiTime });
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
