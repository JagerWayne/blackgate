// APP STORE: the tools on the gate and the store they come from, laid out like
// an app store. A navigation rail on the left (home, installed, available and
// the categories), a featured banner and a grid of app tiles in the middle, and
// a full app page for the picked tool with one big install button.

import { drawFrame } from '../ui/panel.js';
import { software, unlocks } from '../../game/data/content.js';
import { toolPrice } from '../../game/state/economy.js';
import { label, para, keyValue, spacer, custom, section, buttons as buttonRow } from '../ui/controls.js';
import { primary, ghost } from '../ui/styles.js';
import { drawScrolled } from '../ui/scroll.js';
import { drawButton } from '../ui/widgets.js';
import { hit, roundRect } from '../ui/kit.js';
import { draw as drawText, ellipsize, FONT } from '../../game/core/text.js';
import { color, cssA } from '../../game/core/theme.js';
import { versionEffect, NO_TASK } from '../../game/state/toolEffects.js';
import { toolSize } from '../../game/state/apps.js';
import { addTip } from '../../game/core/tooltip.js';
import { noteHint, lockedOut } from '../ui/hint.js';
import { systemFree } from '../../game/state/gameHelpers.js';
import { t as tl } from '../../game/data/language.js';

/// Each tool's family and its colour.
const FAMILY = {
  PasswordCracker: ['BREAK-IN', 0xff6b6b], Decrypter: ['BREAK-IN', 0xff6b6b], CredentialStuff: ['BREAK-IN', 0xff6b6b], SessionHijacker: ['BREAK-IN', 0xff6b6b],
  DdosCannon: ['BYPASS', 0xffc857],
  ZeroTrustMapper: ['NETWORK', 0x4fc3f7], IamProbe: ['NETWORK', 0x4fc3f7], KerberosForger: ['NETWORK', 0x4fc3f7], KernelPrivesc: ['NETWORK', 0x4fc3f7],
  AttackSurfaceHud: ['HUD', 0xb39ddb], HopVisualizer: ['HUD', 0xb39ddb], CloudGraphHud: ['HUD', 0xb39ddb],
  ProxyBypass: ['BYPASS', 0xffc857], FirewallBypass: ['BYPASS', 0xffc857], MonitorBypass: ['BYPASS', 0xffc857],
  TraceTracker: ['STEALTH', 0x7aa2ff], LogModifier: ['STEALTH', 0x7aa2ff], LogDeleter: ['STEALTH', 0x7aa2ff],
  FileCopier: ['DATA', 0x5be49b], FileDeleter: ['DATA', 0x5be49b],
  OsintSweep: ['SOCIAL', 0xc792ea], VoiceAnalyser: ['SOCIAL', 0xc792ea], SpoofKit: ['SOCIAL', 0xc792ea],
};
export const familyOf = (kind) => FAMILY[kind] ?? ['TOOL', 0x9aa5b1];
/// What each category is called to someone new to this.
const PLAIN = {
  'BREAK-IN': 'Open locks', BYPASS: 'Get past defences', NETWORK: 'Move inside a company', HUD: 'Information panels',
  STEALTH: 'Cover your tracks', DATA: 'Take and delete files', SOCIAL: 'People and phones', TOOL: 'Tool',
};
export const plainOf = (fam) => PLAIN[fam] ?? fam;
export const CATEGORIES = [...new Set(Object.values(FAMILY).map((f) => f[0]))];
const NAV = [['ALL', 'Home'], ['INSTALLED', 'Installed'], ['SHOP', 'Available']];
const BAR_H = 36;
const TILE_W = 230; // the narrowest a card gets; cards stretch to fill the row
const TILE_MAX = 380;
const TILE_H = 118;
const GAP = 10;

/// Two letters for an app icon.
function initials(name) {
  const words = name.split(/[\s-]+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase();
}

/// The rounded coloured square an app wears as its icon.
function icon(ctx, sk, x, y, size, tint, name) {
  ctx.fillStyle = color(tint);
  roundRect(ctx, { x, y, w: size, h: size }, Math.round(size / 5));
  ctx.fill();
  drawText(ctx, initials(name), x + size / 2, y + size / 2 + 1, Math.round(size * 0.36), color(sk.panel), { align: 'center', baseline: 'middle' });
}

/// Draws the software window.
export function drawSoftware(ctx, sk, r, game, ui, input, events, view) {
  const owned = game.player.tools.length;
  const tools = software();
  const body = drawFrame(ctx, sk, r, ui, input, events, '', `${owned} of ${tools.length} installed`);
  const levelOf = (kind) => game.player.tools.find((t) => t.kind === kind)?.level ?? 0;
  const filter = view.filter ?? 'ALL';
  const picked = view.sel ?? tools[0]?.kind;

  // -- the navigation rail ---------------------------------------------------------
  // the rail takes about a fifth of the window, never too thin to read or too wide
  const navW = Math.max(118, Math.min(176, Math.floor(body.w * 0.22)));
  const items = [...NAV, null, ...CATEGORIES.map((c) => [c, plainOf(c)])];
  let y = body.y;
  items.forEach((it) => {
    if (!it) {
      drawText(ctx, 'CATEGORIES', body.x + 12, y + 8, FONT.body, color(sk.dim));
      y += 28;
      return;
    }
    const row = { x: body.x, y, w: navW - 8, h: 28 };
    const on = it[0] === filter;
    if (on) {
      ctx.fillStyle = cssA(sk.accent, 0.18);
      ctx.fillRect(row.x, row.y, row.w, row.h);
      ctx.fillStyle = color(sk.accent);
      ctx.fillRect(row.x, row.y, 3, row.h);
    } else if (hit(row, input)) {
      ctx.fillStyle = cssA(sk.accent, 0.08);
      ctx.fillRect(row.x, row.y, row.w, row.h);
    }
    drawText(ctx, ellipsize(ctx, it[1], FONT.body, row.w - 20), row.x + 12, row.y + 7, FONT.body, color(on ? sk.text_hi : sk.text));
    // the Home entry can be a tutorial target; the others are shut while a step is lit
    noteHint(ui, `sw.nav.${it[0]}`, row);
    if (input.pressed && hit(row, input) && !lockedOut(ui, `sw.nav.${it[0]}`)) {
      view.filter = it[0];
      view.page = false;
    }
    y += 30;
  });

  // -- the store bar: the title or the way back, and the money --------------------
  const main = { x: body.x + navW, y: body.y, w: body.w - navW, h: body.h };
  const page = !!view.page && tools.some((t) => t.kind === picked);
  if (page) {
    if (drawButton(ctx, ui, sk, 'sw.back', { x: main.x, y: main.y, w: 90, h: BAR_H - 6 }, '< BACK', ghost(), input)) view.page = false;
  } else {
    drawText(ctx, 'App Store', main.x + 4, main.y + 9, FONT.heading, color(sk.text_hi));
  }
  drawText(ctx, `${game.player.credits.toLocaleString('en-US')} cr`, main.x + main.w - 6, main.y + 9, FONT.emphasis, color(sk.warn), { align: 'right' });
  const area = { x: main.x, y: main.y + BAR_H + 4, w: main.w, h: main.h - BAR_H - 4 };

  if (page) {
    drawPage(ctx, sk, area, game, ui, input, events, tools.find((t) => t.kind === picked), levelOf(picked));
    return;
  }

  // -- the banner and the grid of tiles ------------------------------------------
  const shown = tools
    .map((d, index) => ({ d, index, have: levelOf(d.kind) }))
    .filter(({ d, have }) => {
      if (filter === 'ALL') return true;
      if (filter === 'INSTALLED') return have > 0;
      if (filter === 'SHOP') return have < d.versions.length;
      return familyOf(d.kind)[0] === filter;
    });
  const unlock = unlocks();
  const featured = filter === 'ALL'
    ? tools.map((d, index) => ({ d, index, have: levelOf(d.kind) }))
      .find(({ d, have }) => have < d.versions.length && game.player.rating >= (unlock[have] ?? 0) && game.player.credits >= toolPrice(d, have + 1))
    : null;
  const open = (index) => {
    events.push({ type: 'select', id: 'sw.list', index });
    view.page = true;
  };
  const cols = Math.max(Math.floor((area.w - 22 + GAP) / (TILE_W + GAP)), 1);
  const rows = Math.ceil(shown.length / cols);
  const controls = [];
  const needed = neededTool(game, tools, levelOf);
  if (needed) {
    controls.push(custom(44, (c, s2, rr, inp) => {
      c.fillStyle = cssA(s2.warn, inp && hit(rr, inp) ? 0.3 : 0.18);
      roundRect(c, rr, 6);
      c.fill();
      drawText(c, 'YOUR JOB NEEDS', rr.x + 12, rr.y + 8, FONT.body, color(s2.warn));
      drawText(c, ellipsize(c, `${needed.d.name} // ${needed.why}`, FONT.emphasis, rr.w - 24), rr.x + 12, rr.y + 24, FONT.emphasis, color(s2.text_hi));
      if (inp?.pressed && hit(rr, inp) && !lockedOut(ui, '')) open(needed.index);
    }), spacer(8));
  }
  if (featured) {
    controls.push(custom(96, (c, s, rr, inp) => {
      const tint = familyOf(featured.d.kind)[1];
      c.fillStyle = cssA(tint, inp && hit(rr, inp) ? 0.32 : 0.22);
      roundRect(c, rr, 8);
      c.fill();
      icon(c, s, rr.x + 16, rr.y + 16, 64, tint, featured.d.name);
      drawText(c, 'FEATURED // READY TO INSTALL', rr.x + 96, rr.y + 14, FONT.body, color(tint));
      drawText(c, ellipsize(c, featured.d.name, FONT.heading, rr.w - 112), rr.x + 96, rr.y + 34, FONT.heading, color(s.text_hi));
      drawText(c, ellipsize(c, featured.d.short, FONT.body, rr.w - 112), rr.x + 96, rr.y + 62, FONT.body, color(s.text));
      if (inp?.pressed && hit(rr, inp) && !lockedOut(ui, '')) open(featured.index);
    }), spacer(10));
  }
  controls.push(custom(Math.max(rows * (TILE_H + GAP), 30), (c, s, rr, inp) => {
    if (!shown.length) drawText(c, 'nothing here', rr.x + 8, rr.y + 8, FONT.body, color(s.dim));
    shown.forEach(({ d, index, have }, i) => {
      // the cards share the row evenly, so no strip of space is left over
      const tw = Math.min(Math.floor((rr.w - (cols - 1) * GAP) / cols), TILE_MAX);
      const tile = { x: rr.x + (i % cols) * (tw + GAP), y: rr.y + Math.floor(i / cols) * (TILE_H + GAP), w: tw, h: TILE_H };
      noteHint(ui, `sw.${d.kind}`, tile);
      // a tile the tutorial points at is scrolled to once, so it is never out of sight
      if (ui.hint?.has(`sw.${d.kind}`) && view.revealed !== d.kind) {
        view.revealed = d.kind;
        ui.scroll.set(`sw.grid.${filter}`, Math.max(tile.y - area.y + (ui.scroll.get(`sw.grid.${filter}`) ?? 0) - 12, 0));
      }
      drawTile(c, s, tile, d, have, inp);
      // only a card that is on show can be hovered
      if (tile.y + tile.h > area.y && tile.y < area.y + area.h) addTip(tile, `${d.name} // ${plainOf(familyOf(d.kind)[0])}\n${d.use ?? ''}\n${d.desc}`);
      if (inp?.pressed && hit(tile, inp) && !lockedOut(ui, `sw.${d.kind}`)) open(index);
    });
  }));
  drawScrolled(ctx, sk, area, controls, `sw.grid.${filter}`, ui, input, events);
}

/// A tool an accepted job needs and the operator does not own yet, with why.
export function neededTool(game, tools, levelOf) {
  const WANT = { retrieve: ['FileCopier', 'copying the file'], delete: ['FileDeleter', 'destroying the file'], destroy: ['FileDeleter', 'destroying the files'], modify: ['PasswordCracker', 'opening the records lock'] };
  for (const c of game.contracts) {
    if (c.state !== 'accepted') continue;
    const w = WANT[c.kind];
    if (!w || levelOf(w[0]) > 0) continue;
    const index = tools.findIndex((t) => t.kind === w[0]);
    if (index >= 0) return { d: tools[index], index, why: `${w[1]} for job #${c.id}` };
  }
  return null;
}

/// One app card: icon, name and category side by side, the plain "use it when"
/// line under them, and the price or how far it is installed along the bottom.
function drawTile(ctx, sk, r, d, have, input) {
  const [fam, tint] = familyOf(d.kind);
  ctx.fillStyle = color(input && hit(r, input) ? sk.raised : sk.panel2);
  roundRect(ctx, r, 8);
  ctx.fill();
  icon(ctx, sk, r.x + 12, r.y + 12, 52, tint, d.name);
  const tx = r.x + 76;
  const room = r.w - 76 - 12;
  drawText(ctx, ellipsize(ctx, d.name, FONT.emphasis, room), tx, r.y + 14, FONT.emphasis, color(have ? sk.text_hi : sk.text));
  drawText(ctx, ellipsize(ctx, plainOf(fam), FONT.body, room), tx, r.y + 38, FONT.body, cssA(tint, 0.9));
  drawText(ctx, ellipsize(ctx, d.use ?? d.short, FONT.body, r.w - 24), r.x + 12, r.y + 72, FONT.body, color(sk.dim));
  if (have) {
    for (let i = 0; i < d.versions.length; i += 1) {
      ctx.fillStyle = color(i < have ? tint : sk.line);
      ctx.fillRect(r.x + 12 + i * 12, r.y + 98, 9, 6);
    }
    drawText(ctx, 'INSTALLED', r.x + r.w - 12, r.y + 94, FONT.body, color(sk.ok), { align: 'right' });
  } else {
    drawText(ctx, `${d.price.toLocaleString('en-US')} cr`, r.x + 12, r.y + 94, FONT.body, color(sk.warn));
  }
}

/// The full page of one app: its icon and title, one big install button, the
/// description, and every version with its effect.
function drawPage(ctx, sk, area, game, ui, input, events, d, have) {
  const unlock = unlocks();
  const [fam, tint] = familyOf(d.kind);
  const priceOf = (level) => toolPrice(d, level);
  const nameOf = (level) => d.versions[level - 1] ?? `V${level}`;
  const idle = versionEffect(d.kind, 1) === NO_TASK;
  const free = Math.max(systemFree(game), 0);

  const controls = [
    custom(112, (c, s, rr) => {
      icon(c, s, rr.x + 4, rr.y + 6, 96, tint, d.name);
      drawText(c, plainOf(fam), rr.x + 116, rr.y + 10, FONT.body, color(tint));
      drawText(c, ellipsize(c, d.name, FONT.title, rr.w - 128), rr.x + 116, rr.y + 30, FONT.title, color(s.text_hi));
      drawText(c, have ? `installed // version ${have} of ${d.versions.length}` : 'not installed', rr.x + 116, rr.y + 62, FONT.body, color(have ? s.ok : s.dim));
      for (let i = 0; i < d.versions.length; i += 1) {
        c.fillStyle = color(i < have ? tint : s.line);
        c.fillRect(rr.x + 116 + i * 16, rr.y + 86, 12, 8);
      }
    }),
  ];

  // the install button: the next version, or why not
  const next = have + 1;
  if (next <= d.versions.length) {
    const need = unlock[next - 1] ?? 0;
    const extra = toolSize(d.kind, next) - toolSize(d.kind, have);
    if (game.player.rating < need) controls.push(label(`${nameOf(next)} needs rating ${need} (you have ${game.player.rating})`, FONT.body, sk.dim));
    else {
      controls.push(buttonRow([{
        id: `sw.buy.${d.kind}.${next}`,
        text: tl('windows.software.v_cr', have ? 'UPDATE TO' : 'INSTALL', next, nameOf(next), priceOf(next).toLocaleString('en-US')),
        style: { ...primary(), disabled: game.player.credits < priceOf(next) || idle || extra > free },
      }]));
      if (extra > free) controls.push(label(`needs ${extra} GB on the gateway drive, ${free} GB free`, FONT.body, sk.danger));
      else if (idle) controls.push(label('not for sale: no task uses this tool yet', FONT.body, sk.warn));
      else if (game.player.credits < priceOf(next)) controls.push(label(`${(priceOf(next) - game.player.credits).toLocaleString('en-US')} cr short`, FONT.body, sk.danger));
    }
  } else controls.push(label('fully updated', FONT.body, sk.ok));

  controls.push(spacer(8), section('USE IT WHEN'), para(d.use ?? d.short, FONT.body, sk.text), spacer(6), section('WHAT IT DOES'), para(d.desc, FONT.body, sk.text));
  if (d.tech) controls.push(spacer(6), label(`hackers call this a ${d.tech}`, FONT.body, sk.dim));
  controls.push(spacer(8), section('VERSIONS'));
  for (let level = 1; level <= d.versions.length; level += 1) {
    const need = unlock[level - 1] ?? 0;
    const state = have >= level ? 'INSTALLED' : game.player.rating < need ? `RATING ${need}` : `${priceOf(level).toLocaleString('en-US')} cr`;
    const t = have >= level ? sk.ok : game.player.rating < need ? sk.dim : sk.warn;
    controls.push(keyValue(`V${level} ${nameOf(level)}`, state, t));
    controls.push(label(`${versionEffect(d.kind, level)} // ${toolSize(d.kind, level)} GB on the drive`, FONT.body, sk.dim));
  }
  drawScrolled(ctx, sk, area, controls, 'sw.page', ui, input, events);
}
