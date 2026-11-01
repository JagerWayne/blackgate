// OPERATOR: the record of the run so far.

import { section, label, keyValue, chips, spacer } from '../ui/controls.js';
import { drawFrame, readable } from '../ui/panel.js';
import { drawScrolled } from '../ui/scroll.js';
import { rankName } from '../core/theme.js';

/// Draws the operator window.
export function drawStats(ctx, sk, r, game, ui, input, events) {
  const body = drawFrame(ctx, sk, r, ui, input, events, '', 'the record of the run so far');
  const s = game.stats;
  const controls = [
    label(game.player.handle, 15, sk.text_hi),
    chips([[rankName(game.player.rating), sk.accent], [`RATING ${game.player.rating}`, sk.dim]]),
    spacer(4),
    section('RECORD'),
    keyValue('MISSIONS COMPLETE', String(s.missionsDone), sk.text),
    keyValue('MISSIONS FAILED', String(s.missionsFailed), s.missionsFailed > 0 ? sk.danger : sk.text),
    keyValue('FILES EXTRACTED', String(s.filesStolen), sk.text),
    keyValue('LOG SETS WIPED', String(s.logsWiped), sk.text),
    keyValue('CLEAN ESCAPES', String(s.tracesEscaped), sk.text),
    section('MONEY AND HEAT'),
    keyValue('TOTAL EARNED', `${s.earned} cr`, sk.warn),
    keyValue('CURRENT BALANCE', `${game.player.credits} cr`, sk.warn),
    keyValue('HEAT', `${Math.round(game.player.heat)}/100`, game.player.heat > 75 ? sk.danger : sk.text),
    keyValue('STORY ACT', `${Math.min(game.story.act, 4)}/4`, sk.text),
    section('RIVAL OPERATORS'),
  ];
  game.rivals.forEach((rv) => controls.push(keyValue(rv.handle, String(rv.rating), sk.text)));
  drawScrolled(ctx, sk, readable(body), controls, 'stats.form', ui, input, events);
}
