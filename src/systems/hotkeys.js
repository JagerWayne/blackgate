// The keys and clicks the shell itself answers, read once per drawn frame.
// They live here and not in the fixed step: a frame can run no step or two,
// and a press must be seen exactly once.

import { setDark, isDark } from '../core/theme.js';
import { makeBoot } from '../render/boot.js';
import { WINDOWS, openWindow } from '../state/windows.js';
import { desktop } from '../state/desk.js';

/// Applies the shell's own keys for this frame.
export function frameKeys(state) {
  const input = state.input;
  if (state.mode === 'boot' && state.boot && (input.pressed || input.enter)) state.boot.done = true;
  // the machine is off: a key or a click turns it back on, and the boot is
  // skipped, because the operator asked for it
  if (state.mode === 'off' && (input.anyKey || input.pressed)) {
    state.mode = 'boot';
    state.boot = makeBoot();
    state.boot.done = true;
  }
  // `D` swaps the skin, unless the operator is typing into a field
  if (!state.ui.focus && input.text.toLowerCase() === 'd') {
    setDark(!isDark());
    if (state.game) state.game.settings.darkSkin = isDark();
  }
  // in play, 1-9 open the Start menu's applications and Space pauses
  if (!state.ui.focus && state.mode === 'play' && state.game) {
    const app = WINDOWS.filter((w) => !w.hidden)[Number(input.text) - 1];
    if (/^[1-9]$/.test(input.text) && app) openWindow(state.windows, app.key, desktop(state.view.w, state.view.h));
    else if (input.text === ' ') state.game.paused = !state.game.paused;
  }
  keyboard(state);
  // a press lets go of the typing focus; the field under the pointer takes
  // it back as it is drawn this frame
  if (input.pressed) state.ui.focus = null;
}

/// The keyboard model: Tab and Shift+Tab walk the text fields, Escape leaves
/// a field (or shuts the Start menu), Enter presses the default button. The
/// fields and the default are the ones the last frame drew.
function keyboard(state) {
  const ui = state.ui;
  const input = state.input;
  ui.lastFields = ui.fields ?? [];
  ui.fields = [];
  ui.lastDefault = ui.defaultId ?? null;
  ui.defaultId = null;
  ui.fire = null;
  if (input.tab && ui.lastFields.length) {
    const at = ui.lastFields.indexOf(ui.focus);
    const n = ui.lastFields.length;
    const next = at < 0 ? (input.shift ? n - 1 : 0) : (at + (input.shift ? n - 1 : 1)) % n;
    ui.focus = ui.lastFields[next];
  }
  // the field Escape left, so its window can clear it too
  ui.escFrom = null;
  if (input.esc) {
    if (ui.focus) {
      ui.escFrom = ui.focus;
      ui.focus = null;
    }
    else if (state.startOpen) state.startOpen = false;
  }
  // Enter in the notes is a new line, not a button
  if (input.enter && ui.focus !== 'notepad' && ui.lastDefault) ui.fire = ui.lastDefault;
}
