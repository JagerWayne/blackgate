import { bus } from './bridge.js';

const typing = (el) => !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);

/// The keys the desktop answers itself, as in the classic game (game/systems/hotkeys.js):
/// Space pauses the world clock, the backtick opens the Command Prompt with the cursor in it,
/// and Escape leaves a field or shuts the Start menu. They only work while a run is on and nothing is being typed.
/// Tab and Shift+Tab walk the fields natively, and Enter in a field is handled by the field's own window.
export function mountKeys(state, { closeMenu }) {
  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') {
      if (typing(document.activeElement)) document.activeElement.blur();
      else if (state.startOpen) closeMenu();
      return;
    }
    if (state.mode !== 'play' || !state.game || typing(e.target)) return;
    if (e.key === ' ') {
      e.preventDefault(); // not a press on whichever button last had the focus
      state.game.paused = !state.game.paused;
    } else if (e.key === '`') {
      e.preventDefault();
      bus.emit('window', { key: 'terminal', action: 'open' });
      // the window is put on the desk by the next frame
      setTimeout(() => document.querySelector('[data-tutorial="terminal.input"]')?.focus(), 80);
    }
  });
  // a Space on a focused button presses it when the key comes up: swallow that too
  addEventListener('keyup', (e) => {
    if (e.key === ' ' && state.mode === 'play' && !typing(e.target)) e.preventDefault();
  });
}
