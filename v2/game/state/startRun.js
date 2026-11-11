// Logging in: a new run, or a saved operator's run on this terminal.

import { makeGame } from './gameState.js';
import { loadRun } from './save.js';
import { dailySeed, dailyMod } from './daily.js';

/// Starts a run and returns the game. A saved operator loads their run.
export function startRun(state, w, h) {
  if (state.login.sel > 0) {
    const saved = loadRun(state.login.slots[state.login.sel - 1]?.handle);
    if (saved) return saved;
  }
  // every new run gets its own random world
  // or, when asked, today's world with today's modifier
  const daily = !!state.login.daily;
  const seed = daily ? dailySeed() : Math.floor(Math.random() * 2 ** 31);
  const game = makeGame(state.login.handle.trim() || 'OPERATOR', seed, { bare: true });
  if (daily) game.mod = dailyMod(seed);
  return game;
}
