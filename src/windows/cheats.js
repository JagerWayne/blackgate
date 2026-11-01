// CHEATS: the hidden window behind the BLACKGATE logo. Money, heat, the clock,
// the rating and a few switches, in one readable column.

import { section, label, keyValue, buttons, field, meter } from '../ui/controls.js';
import { ghost, primary, solid } from '../ui/styles.js';
import { drawFrame, readable } from '../ui/panel.js';
import { drawScrolled } from '../ui/scroll.js';
import { rankName } from '../core/theme.js';
import { FONT } from '../core/text.js';
import { SPEEDS, SKIPS, timeScale, cheatsOf } from '../state/cheats.js';
import { RATING_MAX } from '../data/enums.js';

const money = (n) => n.toLocaleString('en-US');
const signed = (n) => `${n > 0 ? '+' : '−'}${money(Math.abs(n))}`;
const on = (flag) => (flag ? primary() : ghost());
/// The jobs the generator can post, and their buttons.
const skipName = (m) => (m >= 1440 ? `+${m / 1440} DAY` : `+${m / 60}H`);

/// Draws the cheat window.
export function drawCheats(ctx, sk, r, game, ui, input, events, view) {
  const body = drawFrame(ctx, sk, r, ui, input, events, '', 'bend the rules of the run');
  const p = game.player;
  const c = cheatsOf(game);
  const scale = timeScale(game);
  const heat = Math.round(p.heat);
  const heatColor = heat > 75 ? sk.danger : heat > 40 ? sk.warn : sk.accent;

  const controls = [
    section('MONEY'),
    keyValue('CREDITS', `${money(p.credits)} cr`, sk.text_hi),
    buttons([1000, 10000, 100000, -1000, -10000].map((n) => ({
      id: `cheat.money.${n}`, text: signed(n), style: n > 0 ? solid() : ghost(),
    }))),
    field('cheat.money.field', view.money ?? '', 'an exact amount, e.g. 250000'),
    buttons([{ id: 'cheat.money.set', text: 'SET AMOUNT', style: { ...primary(), isDefault: true } }]),

    section('HEAT'),
    meter(`HEAT ${heat}${c.freezeHeat !== null ? ' // FROZEN' : ''}`, heat / 100, heatColor),
    buttons([0, 25, 50, 75].map((n) => ({ id: `cheat.heat.set.${n}`, text: String(n), style: ghost() }))),
    buttons([
      { id: 'cheat.heat.nudge.-10', text: '−10', style: ghost() },
      { id: 'cheat.heat.nudge.10', text: '+10', style: ghost() },
      { id: 'cheat.heat.freeze', text: `FREEZE HEAT: ${c.freezeHeat !== null ? 'ON' : 'OFF'}`, style: on(c.freezeHeat !== null) },
    ]),
    label('a raid starts at 100: the menu stops at 99', FONT.body, sk.dim),

    section('TIME'),
    keyValue('CLOCK SPEED', game.paused ? 'PAUSED' : `${scale}x`, sk.text_hi),
    buttons([
      { id: 'cheat.pause', text: 'PAUSE', style: on(game.paused) },
      ...SPEEDS.map((n) => ({ id: `cheat.time.${n}`, text: `${n}x`, style: on(!game.paused && n === scale) })),
    ]),
    buttons(SKIPS.map((m) => ({ id: `cheat.skip.${m}`, text: skipName(m), style: ghost() }))),
    label(
      game.session ? 'close the link to skip time' : 'a skip runs every minute: deadlines, offers and the wire',
      FONT.body,
      game.session ? sk.warn : sk.dim,
    ),

    section('RATING'),
    keyValue('RATING', `${p.rating} // ${rankName(p.rating)}`, sk.text_hi),
    buttons([-10, -1, 1, 10].map((n) => ({
      id: `cheat.rating.${n}`, text: n > 0 ? `+${n}` : `−${-n}`, style: ghost(),
    }))),
    label(`from 0 to ${RATING_MAX}`, FONT.body, sk.dim),

    section('MISSIONS'),
    buttons([{ id: 'cheat.missions', text: 'OPEN MISSION BUILDER', style: primary() }]),
    label('build a job to order: kind, target, objective, payout, deadline, client, brief', FONT.body, sk.dim),

    section('OTHER'),
    buttons([
      { id: 'cheat.trace.freeze', text: `FREEZE TRACE: ${c.freezeTrace ? 'ON' : 'OFF'}`, style: on(c.freezeTrace) },
      { id: 'cheat.map', text: 'REVEAL THE MAP', style: ghost() },
    ]),
    buttons([
      { id: 'cheat.tools', text: 'EVERY TOOL AT V5', style: ghost() },
      { id: 'cheat.gateway', text: 'MAX THE GATEWAY', style: ghost() },
    ]),
  ];
  drawScrolled(ctx, sk, readable(body), controls, 'cheat.scroll', ui, input, events);
}
