// SYSTEM: the settings of the shell and the run.

import { section, label, buttons as buttonRow, check } from '../ui/controls.js';
import { ghost, primary, solid } from '../ui/styles.js';
import { drawFrame, readable } from '../ui/panel.js';
import { drawScrolled } from '../ui/scroll.js';
import { isDark } from '../core/theme.js';
import { timeScale } from '../state/cheats.js';

/// Draws the settings window.
export function drawSettings(ctx, sk, r, game, ui, input, events) {
  const body = drawFrame(ctx, sk, r, ui, input, events, '', 'the shell and the run');
  const dark = isDark();
  const controls = [
    section('APPEARANCE'),
    // the skin in use shows as the primary button
    buttonRow([
      { id: 'set.theme.light', text: 'LIGHT // LUNA', style: dark ? ghost() : primary() },
      { id: 'set.theme.dark', text: 'DARK // NOIR', style: dark ? primary() : ghost() },
    ]),
    label('D swaps the skin from anywhere', 9.5, sk.dim),
    section('BEHAVIOUR'),
    check('set.auto', 'Autosave every 45 seconds', game.settings.autosave),
    check('set.fast', 'Fast-forward world clock (8x)', timeScale(game) > 1),
    section('THE RUN'),
    buttonRow([
      { id: 'set.save', text: 'SAVE NOW', style: solid() },
      { id: 'set.quit', text: 'SAVE + QUIT', style: ghost() },
    ]),
  ];
  drawScrolled(ctx, sk, readable(body), controls, 'set.scroll', ui, input, events);
}
