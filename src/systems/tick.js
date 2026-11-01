// The systems runner: every system, in order, once per fixed step.

import { clockTick } from './clockTick.js';
import { sessionTick } from './sessionTick.js';
import { heatTick } from './heatTick.js';
import { timeScale } from '../state/cheats.js';

/// Runs the simulation for one step.
export function tick(game, dt) {
  game.uiTime += dt;
  game.toasts = game.toasts.filter((t) => game.uiTime - t.born < 5);
  if (game.gameOver || game.paused) return;
  clockTick(game, dt);
  sessionTick(game, dt * timeScale(game));
  heatTick(game, dt * timeScale(game));
}
