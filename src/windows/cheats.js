// CHEATS: the hidden window behind the BLACKGATE logo. Three tabs (PLAYER,
// WORLD, SWITCHES) under a status line that always shows what they change.
// A wide window lays a tab's sections out in two columns.

import { section, label, keyValue, buttons, field, meter, spacer } from '../ui/controls.js';
import { ghost, primary, solid } from '../ui/styles.js';
import { drawFrame } from '../ui/panel.js';
import { drawScrolled } from '../ui/scroll.js';
import { rankName, color } from '../core/theme.js';
import { draw as drawText, ellipsize, FONT } from '../core/text.js';
import { SPEEDS, SKIPS, timeScale, cheatsOf } from '../state/cheats.js';
import { RATING_MAX } from '../data/enums.js';

const CHEAT_TABS = ['PLAYER', 'WORLD', 'SWITCHES'];
const TWO_COLUMNS = 700;

const money = (n) => n.toLocaleString('en-US');
const signed = (n) => `${n > 0 ? '+' : '−'}${money(Math.abs(n))}`;
const on = (flag) => (flag ? primary() : ghost());
const skipName = (m) => (m >= 1440 ? `+${m / 1440} DAY` : `+${m / 60}H`);

/// One switch: its button, then what it does.
const toggle = (id, name, flag, note, sk) => [
  buttons([{ id, text: `${name}: ${flag ? 'ON' : 'OFF'}`, style: on(flag) }]),
  label(note, FONT.body, sk.dim),
  spacer(8),
];
/// One action with no state: its button, then what it does.
const action = (id, name, note, sk) => [
  buttons([{ id, text: name, style: ghost() }]),
  label(note, FONT.body, sk.dim),
  spacer(8),
];

/// The two columns of controls for each tab (the second may be empty).
function tabColumns(tab, game, view, sk) {
  const p = game.player;
  const c = cheatsOf(game);
  const scale = timeScale(game);
  const heat = Math.round(p.heat);
  const heatColor = heat > 75 ? sk.danger : heat > 40 ? sk.warn : sk.accent;

  if (tab === 1) {
    return [[
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
    ], [
      section('MISSIONS'),
      buttons([{ id: 'cheat.missions', text: 'OPEN MISSION BUILDER', style: primary() }]),
      label('build a job to order: kind, target, objective, payout, deadline, client, brief', FONT.body, sk.dim),
    ]];
  }
  if (tab === 2) {
    return [[
      section('SWITCHES'),
      ...toggle('cheat.heat.freeze', 'FREEZE HEAT', c.freezeHeat !== null, 'heat holds where it is', sk),
      ...toggle('cheat.trace.freeze', 'FREEZE TRACE', c.freezeTrace, 'a trace never closes in', sk),
    ], [
      section('ONE-OFFS'),
      ...action('cheat.map', 'REVEAL THE MAP', 'every host shows on the map', sk),
      ...action('cheat.tools', 'EVERY TOOL AT V5', 'you own every tool, at its best version', sk),
      ...action('cheat.gateway', 'MAX THE GATEWAY', 'best chassis, every slot filled', sk),
    ]];
  }
  return [[
    section('MONEY'),
    keyValue('CREDITS', `${money(p.credits)} cr`, sk.text_hi),
    buttons([1000, 10000, 100000].map((n) => ({ id: `cheat.money.${n}`, text: signed(n), style: solid() }))),
    buttons([-1000, -10000].map((n) => ({ id: `cheat.money.${n}`, text: signed(n), style: ghost() }))),
    field('cheat.money.field', view.money ?? '', 'an exact amount, e.g. 250000'),
    buttons([{ id: 'cheat.money.set', text: 'SET AMOUNT', style: { ...primary(), isDefault: true } }]),
  ], [
    section('HEAT'),
    meter(`HEAT ${heat}${c.freezeHeat !== null ? ' // FROZEN' : ''}`, heat / 100, heatColor),
    buttons([0, 25, 50, 75].map((n) => ({ id: `cheat.heat.set.${n}`, text: String(n), style: ghost() }))),
    buttons([
      { id: 'cheat.heat.nudge.-10', text: '−10', style: ghost() },
      { id: 'cheat.heat.nudge.10', text: '+10', style: ghost() },
      { id: 'cheat.heat.freeze', text: `FREEZE: ${c.freezeHeat !== null ? 'ON' : 'OFF'}`, style: on(c.freezeHeat !== null) },
    ]),
    label('a raid starts at 100: the menu stops at 99', FONT.body, sk.dim),
    section('RATING'),
    keyValue('RATING', `${p.rating} // ${rankName(p.rating)}`, sk.text_hi),
    buttons([-10, -1, 1, 10].map((n) => ({
      id: `cheat.rating.${n}`, text: n > 0 ? `+${n}` : `−${-n}`, style: ghost(),
    }))),
    label(`from 0 to ${RATING_MAX}`, FONT.body, sk.dim),
  ]];
}

/// Draws the cheat window.
export function drawCheats(ctx, sk, r, game, ui, input, events, view) {
  const tab = view.tab ?? 0;
  const tabs = CHEAT_TABS.map((t, i) => ({ id: `cheat.tab.${i}`, label: t }));
  const body = drawFrame(ctx, sk, r, ui, input, events, '', 'bend the rules of the run', tabs, tab);

  // the status line: every value the tabs change, on every tab
  const p = game.player;
  const clock = game.paused ? 'PAUSED' : `${timeScale(game)}x`;
  const status = `${money(p.credits)} cr  //  HEAT ${Math.round(p.heat)}  //  CLOCK ${clock}  //  RATING ${p.rating}`;
  drawText(ctx, ellipsize(ctx, status, FONT.body, body.w), body.x, body.y, FONT.body, color(sk.accent));
  const box = { x: body.x, y: body.y + 26, w: body.w, h: body.h - 26 };

  const [left, right] = tabColumns(tab, game, view, sk);
  if (box.w < TWO_COLUMNS) {
    drawScrolled(ctx, sk, box, [...left, ...right], `cheat.scroll.${tab}`, ui, input, events);
    return;
  }
  const half = Math.floor((box.w - 24) / 2);
  drawScrolled(ctx, sk, { ...box, w: half }, left, `cheat.scroll.${tab}.a`, ui, input, events);
  drawScrolled(ctx, sk, { ...box, x: box.x + half + 24, w: half }, right, `cheat.scroll.${tab}.b`, ui, input, events);
}
