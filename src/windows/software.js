// SOFTWARE: the tools on the gate and the shop they come from. A filterable
// list of tool cards on the left, a spec sheet for the picked one on the right:
// its family colour, an upgrade track of five versions, the next buy as one
// big button, and what it costs to run.

import { drawFrame, splitPanel, detailPane } from '../ui/panel.js';
import { software, unlocks } from '../data/content.js';
import { SW_PRICE_MULT } from '../data/enums.js';
import { label, para, keyValue, spacer, custom, meter, buttons as buttonRow } from '../ui/controls.js';
import { primary, ghost } from '../ui/styles.js';
import { drawScrolled } from '../ui/scroll.js';
import { drawButton } from '../ui/widgets.js';
import { hit } from '../ui/kit.js';
import { draw as drawText, ellipsize, FONT } from '../core/text.js';
import { color, cssA } from '../core/theme.js';
import { versionEffect, NO_TASK } from '../state/toolEffects.js';
import { toolRam } from '../systems/sessionTasks.js';

/// Each tool's family and its colour.
const FAMILY = {
  PasswordCracker: ['BREAK-IN', 0xff6b6b], Decrypter: ['BREAK-IN', 0xff6b6b], CredentialStuff: ['BREAK-IN', 0xff6b6b],
  ProxyBypass: ['BYPASS', 0xffc857], FirewallBypass: ['BYPASS', 0xffc857], MonitorBypass: ['BYPASS', 0xffc857],
  TraceTracker: ['STEALTH', 0x7aa2ff], LogModifier: ['STEALTH', 0x7aa2ff], LogDeleter: ['STEALTH', 0x7aa2ff],
  FileCopier: ['DATA', 0x5be49b], FileDeleter: ['DATA', 0x5be49b],
  IpProbe: ['RECON', 0x4fd1d9], LanScan: ['RECON', 0x4fd1d9], HudConnect: ['RECON', 0x4fd1d9],
  OsintSweep: ['SOCIAL', 0xc792ea], VoiceAnalyser: ['SOCIAL', 0xc792ea], SpoofKit: ['SOCIAL', 0xc792ea],
};
const familyOf = (kind) => FAMILY[kind] ?? ['TOOL', 0x9aa5b1];
const FILTERS = ['ALL', 'INSTALLED', 'SHOP'];
const CARD_H = 62;

/// Draws the software window.
export function drawSoftware(ctx, sk, r, game, ui, input, events, view) {
  const owned = game.player.tools.length;
  const tools = software();
  const body = drawFrame(ctx, sk, r, ui, input, events, '', `${owned} of ${tools.length} installed // ${game.player.credits.toLocaleString('en-US')} cr to spend`);
  const [list, detail] = splitPanel(body, 0.44, 300);
  const levelOf = (kind) => game.player.tools.find((t) => t.kind === kind)?.level ?? 0;
  const picked = view.sel ?? tools[0]?.kind;

  // -- the filter, then the cards ------------------------------------------------
  const filter = view.filter ?? 'ALL';
  const fw = Math.floor((list.w - 8) / 3);
  FILTERS.forEach((f, i) => {
    const rr = { x: list.x + i * (fw + 4), y: list.y, w: fw, h: 26 };
    if (drawButton(ctx, ui, sk, `sw.filter.${f}`, rr, f, f === filter ? primary() : ghost(), input)) view.filter = f;
  });
  const shown = tools
    .map((d, index) => ({ d, index, have: levelOf(d.kind) }))
    .filter(({ have }) => filter === 'ALL' || (filter === 'INSTALLED' ? have > 0 : have < 5));
  const cards = custom(Math.max(shown.length * (CARD_H + 6), 30), (c, s, rr, inp) => {
    if (!shown.length) drawText(c, 'nothing here', rr.x + 8, rr.y + 8, FONT.body, color(s.dim));
    shown.forEach(({ d, index, have }, i) => {
      const card = { x: rr.x, y: rr.y + i * (CARD_H + 6), w: rr.w, h: CARD_H };
      drawCard(c, s, card, d, have, d.kind === picked, inp);
      if (inp?.pressed && hit(card, inp)) events.push({ type: 'select', id: 'sw.list', index });
    });
  });
  drawScrolled(ctx, sk, { x: list.x, y: list.y + 34, w: list.w, h: list.h - 34 }, [cards], `sw.cards.${filter}`, ui, input, events);

  // -- the spec sheet --------------------------------------------------------------
  const inner = detailPane(ctx, sk, detail);
  const d = tools.find((t) => t.kind === picked);
  if (!d) return;
  const have = levelOf(d.kind);
  const unlock = unlocks();
  const [fam, tint] = familyOf(d.kind);
  const priceOf = (level) => Math.floor(d.price * SW_PRICE_MULT[level]);
  const nameOf = (level) => d.versions[level - 1] ?? `V${level}`;
  const idle = versionEffect(d.kind, 1) === NO_TASK;

  const controls = [
    custom(64, (c, s, rr) => {
      c.fillStyle = cssA(tint, 0.14);
      c.fillRect(rr.x, rr.y, rr.w, rr.h);
      c.fillStyle = color(tint);
      c.fillRect(rr.x, rr.y, 4, rr.h);
      drawText(c, fam, rr.x + 14, rr.y + 8, FONT.body, color(tint));
      drawText(c, ellipsize(c, d.name.toUpperCase(), FONT.heading, rr.w - 120), rr.x + 14, rr.y + 28, FONT.heading, color(s.text_hi));
      drawText(c, have ? `v${have} / 5` : 'NOT OWNED', rr.x + rr.w - 12, rr.y + 30, FONT.emphasis, color(have ? s.ok : s.dim), { align: 'right' });
    }),
    spacer(6),
    para(d.desc, FONT.body, sk.text),
    spacer(6),
    // the upgrade track: owned, can buy, needs rating
    custom(54, (c, s, rr) => {
      const step = (rr.w - 40) / 4;
      c.strokeStyle = color(s.line);
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(rr.x + 20, rr.y + 14);
      c.lineTo(rr.x + rr.w - 20, rr.y + 14);
      c.stroke();
      for (let level = 1; level <= 5; level += 1) {
        const x = rr.x + 20 + (level - 1) * step;
        const locked = game.player.rating < (unlock[level - 1] ?? 0);
        const dot = level <= have ? s.ok : locked ? s.dim : s.warn;
        if (level <= have && level > 1) {
          c.strokeStyle = color(s.ok);
          c.beginPath();
          c.moveTo(x - step, rr.y + 14);
          c.lineTo(x, rr.y + 14);
          c.stroke();
        }
        c.fillStyle = color(dot);
        c.beginPath();
        c.arc(x, rr.y + 14, level === have + 1 && !locked ? 8 : 6, 0, Math.PI * 2);
        c.fill();
        drawText(c, `V${level}`, x, rr.y + 28, FONT.body, color(dot), { align: 'center' });
      }
    }),
  ];

  // the next version: one big button, or why not
  const next = have + 1;
  if (next <= 5) {
    const need = unlock[next - 1] ?? 0;
    if (game.player.rating < need) controls.push(label(`V${next} ${nameOf(next)} needs rating ${need} (you have ${game.player.rating})`, FONT.body, sk.dim));
    else {
      controls.push(buttonRow([{
        id: `sw.buy.${d.kind}.${next}`,
        text: `${have ? 'UPGRADE' : 'BUY'} V${next} ${nameOf(next)} // ${priceOf(next).toLocaleString('en-US')} cr`,
        style: { ...primary(), disabled: game.player.credits < priceOf(next) || idle },
      }]));
      if (idle) controls.push(label('not for sale: no task uses this tool yet', FONT.body, sk.warn));
      else if (game.player.credits < priceOf(next)) controls.push(label(`${(priceOf(next) - game.player.credits).toLocaleString('en-US')} cr short`, FONT.body, sk.danger));
    }
  } else controls.push(label('fully upgraded', FONT.body, sk.ok));

  controls.push(spacer(6));
  const ram = toolRam(d);
  controls.push(meter(`RAM WHILE RUNNING // ${ram} GB`, Math.min(ram / 64, 1), sk.warn));
  controls.push(spacer(4));
  for (let level = 1; level <= 5; level += 1) {
    const need = unlock[level - 1] ?? 0;
    const state = have >= level ? 'INSTALLED' : game.player.rating < need ? `RATING ${need}` : `${priceOf(level).toLocaleString('en-US')} cr`;
    const t = have >= level ? sk.ok : game.player.rating < need ? sk.dim : sk.warn;
    controls.push(keyValue(`V${level} ${nameOf(level)}`, state, t));
    controls.push(label(versionEffect(d.kind, level), FONT.body, sk.dim));
  }
  drawScrolled(ctx, sk, inner, controls, 'sw.detail', ui, input, events);
}

/// One tool card: family bar, name, short line, and five pips or the price.
function drawCard(ctx, sk, r, d, have, sel, input) {
  const [fam, tint] = familyOf(d.kind);
  const hot = input && hit(r, input);
  ctx.fillStyle = color(sel ? sk.raised : hot ? sk.panel : sk.panel2);
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = sel ? color(tint) : cssA(tint, 0.3);
  ctx.lineWidth = 1;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  ctx.fillStyle = color(tint);
  ctx.fillRect(r.x, r.y, 4, r.h);
  const right = r.x + r.w - 10;
  drawText(ctx, ellipsize(ctx, d.name, FONT.emphasis, r.w - 110), r.x + 14, r.y + 10, FONT.emphasis, color(have ? sk.text_hi : sk.text));
  drawText(ctx, ellipsize(ctx, d.short, FONT.body, r.w - 24), r.x + 14, r.y + 36, FONT.body, color(sk.dim));
  if (have) {
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = color(i < have ? tint : sk.track ?? sk.line);
      ctx.fillRect(right - (5 - i) * 12 + 2, r.y + 14, 9, 9);
    }
  } else drawText(ctx, `${d.price.toLocaleString('en-US')} cr`, right, r.y + 10, FONT.body, color(sk.warn), { align: 'right' });
  if (!have) drawText(ctx, fam, right, r.y + 36, FONT.body, cssA(tint, 0.8), { align: 'right' });
}
