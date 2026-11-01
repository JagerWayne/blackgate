// Logging in: a new run, or a saved operator's run on this terminal.

import { makeGame } from './gameState.js';
import { loadRun } from './save.js';
import { openWindow } from './windows.js';
import { desktop } from './desk.js';
import { setDark } from '../core/theme.js';

/// Starts a run and returns the game. A saved operator loads their run.
export function startRun(state, w, h) {
  if (state.login.sel > 0) {
    const saved = loadRun(state.login.slots[state.login.sel - 1]?.handle);
    if (saved) {
      setDark(saved.settings.darkSkin);
      openShell(state.windows, w, h);
      return saved;
    }
  }
  const seed = state.login.seed.trim() ? hashSeed(state.login.seed.trim()) : Math.floor(Math.random() * 2 ** 31);
  const game = makeGame(state.login.handle.trim() || 'OPERATOR', seed);
  setDark(game.settings.darkSkin);
  openShell(state.windows, w, h);
  return game;
}

/// The windows a fresh run opens with.
function openShell(windows, w, h) {
  const desk = desktop(w, h);
  openWindow(windows, 'mail', desk);
  openWindow(windows, 'contracts', desk);
}

/// A seed from a word.
function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 1;
}
