// DEVICE MANAGER: the machine at a glance. A header with the machine's name and
// state, six metric tiles, and below them the motherboard on the left and an
// inspector on the right (SLOT, STOCK, BUILD). Buying is done on eForest; what
// arrives lands in STOCK. BUILD makes a second machine from stock in the
// background and migrates to it. Below 900 px the board becomes a fourth tab.

import { drawFrame, dragWidth } from '../ui/panel.js';
import { drawButton } from '../ui/widgets.js';
import { ghost, primary } from '../ui/styles.js';
import { statTile, chip, segmented } from '../ui/dash.js';
import { relocateError } from '../../game/systems/physical.js';
import { storageUsed } from '../../game/state/gameState.js';
import { downloadsUsed } from '../../game/state/gameHelpers.js';
import { appsUsed } from '../../game/state/apps.js';
import { buildOf, buildStage, buildLeft } from '../../game/state/build.js';
import * as gw from '../../game/state/gateway.js';
import { draw as drawText, ellipsize, measure, FONT } from '../../game/core/text.js';
import { color } from '../../game/core/theme.js';
import { drawBoard } from './gatewayBoard.js';
import { drawInspector } from './gatewaySlot.js';
import { drawStock } from './gatewayShop.js';
import { drawBuild } from './gatewayBuild.js';
import { forms } from '../../game/data/content.js';
import { t as tl } from '../../game/data/language.js';

/// Below this width the board and the inspector no longer fit side by side.
const WIDE = 900;
const TILE_H = 80;
const TILE_GAP = 8;

const gb = (n) => (n >= 1024 ? `${Math.round(n / 102.4) / 10} TB` : `${n} GB`);
const pct = (n) => `${Math.round(n * 100)}%`;

/// The six metric tiles: what the machine can do, and how full its drives are.
export function metrics(game) {
  const g = game.player.gateway;
  const shared = gw.sharedDrive(g);
  const sys = gw.systemDrive(g);
  const sysCap = shared ? gw.storage(g) : gw.systemCap(g);
  const sysUsed = shared ? storageUsed(game) : appsUsed(game);
  const strCap = gw.downloadCap(g);
  const strUsed = downloadsUsed(game);
  const defense = gw.defense(g);
  return [
    ['THREAD SLOTS', String(gw.lanes(g)), { sub: tl('windows.gateway.processors', gw.usedSlots(g, 'cpu'), gw.slotsFor(g, 'cpu')) }],
    ['UNLOCK SPEED', `${(gw.crypt(g) * gw.fpga(g)).toFixed(1)}x`, { sub: tl('windows.gateway.booster_x_fpga_x', gw.crypt(g), gw.fpga(g)) }],
    [shared ? 'DRIVE (C:) apps + files' : 'SYS DRIVE (C:)', `${sysUsed}/${gb(sysCap)}`, { frac: sysCap ? sysUsed / sysCap : 0, sub: tl('windows.gateway.apps_at', sys ? gw.driveName(g, sys) : 'none', pct(gw.systemSpeed(g))) }],
    ['STR DRIVES (D:)', shared ? 'shared' : `${strUsed}/${gb(strCap)}`, { frac: shared || !strCap ? null : strUsed / strCap, sub: tl('windows.gateway.bays_downloads_at', gw.drives(g).length, gw.slotsFor(g, 'storage'), pct(gw.driveSpeed(g))) }],
    ['INTERNET', `${gw.bandwidth(g)} Mb/s`, { sub: tl('windows.gateway.relay_hops', gw.hops(g)) }],
    ['DEFENCE', defense, { tone: defense === 'NO PROTECTION' ? 'warn' : null, sub: tl('windows.gateway.security_slots', gw.usedSlots(g, 'security'), gw.slotsFor(g, 'security')) }],
  ];
}

/// Draws the Device Manager window.
export function drawGateway(ctx, sk, r, game, ui, input, events, view) {
  const g = game.player.gateway;
  const chassis = gw.chassisOf(g);
  const now = game.clock.minutes;
  const migrating = gw.migrating(g, now);
  const stage = buildStage(game);
  const body = drawFrame(ctx, sk, r, ui, input, events, '', '');

  // -- the header: which machine this is, its state, and the store one click away ------
  const nameW = Math.min(measure(ctx, chassis.name, FONT.heading), body.w * 0.4);
  drawText(ctx, ellipsize(ctx, chassis.name, FONT.heading, nameW), body.x, body.y, FONT.heading, color(sk.text_hi));
  let cx = body.x + nameW + 14;
  cx += chip(ctx, sk, cx, body.y + 2, migrating ? `RECONFIGURING ${gw.migrateLeft(g, now)} MIN` : 'ONLINE', migrating ? 'warn' : 'ok') + 6;
  if (stage === 'kit') chip(ctx, sk, cx, body.y + 2, 'KIT OPEN', 'accent');
  else if (stage === 'assembling') chip(ctx, sk, cx, body.y + 2, `BUILDING ${buildLeft(game)} MIN`, 'accent');
  else if (stage === 'ready') chip(ctx, sk, cx, body.y + 2, 'BUILD READY', 'ok');
  const board = gw.boardOf(g);
  drawText(ctx, ellipsize(ctx, `${forms()[chassis.form - 1]} CASE // ${board.name} // ${chassis.trait_name} // IP ${g.ip}`, FONT.body, body.w - 330), body.x, body.y + 28, FONT.body, color(sk.dim));
  const shop = { x: body.x + body.w - 160, y: body.y, w: 160, h: 30 };
  if (drawButton(ctx, ui, sk, 'gw.eforest', shop, 'BUY ON eFOREST', { ...primary(), tip: tl('windows.gateway.open_eforest_in_internet') }, input)) {
    events.push({ type: 'click', id: 'gw.eforest' });
  }
  if (chassis.mobile) {
    const why = relocateError(game);
    const btn = { x: shop.x - 126, y: body.y, w: 118, h: 30 };
    if (drawButton(ctx, ui, sk, 'gw.relocate', btn, 'RELOCATE', { ...(why ? ghost() : primary()), disabled: !!why, tip: why ?? 'Two hours on the road; the investigation loses the trail.' }, input)) {
      events.push({ type: 'click', id: 'gw.relocate' });
    }
  }

  // -- the metric tiles ----------------------------------------------------------------
  const tiles = metrics(game);
  const cols = body.w >= 1000 ? 6 : body.w >= 640 ? 3 : 2;
  const tw = (body.w - TILE_GAP * (cols - 1)) / cols;
  const tilesY = body.y + 54;
  // a short window keeps its room for the list: shorter tiles without their sub line
  const compact = body.h < 560;
  const th = compact ? 56 : TILE_H;
  tiles.forEach(([label, value, opts], i) => {
    const t = { x: body.x + (i % cols) * (tw + TILE_GAP), y: tilesY + Math.floor(i / cols) * (th + TILE_GAP), w: tw, h: th };
    statTile(ctx, sk, t, label, value, compact ? { ...opts, sub: '' } : opts);
  });
  const top = tilesY + Math.ceil(tiles.length / cols) * (th + TILE_GAP) + 2;
  const area = { x: body.x, y: top, w: body.w, h: Math.max(body.y + body.h - top, 120) };

  // -- the board on the left, the inspector on the right ---------------------------------
  const wide = area.w >= WIDE;
  const stocked = game.player.stock?.length ?? 0;
  const build = buildOf(game);
  const tabs = [
    { id: 'gw.tab.0', label: 'SLOT' },
    { id: 'gw.tab.1', label: stocked ? `STOCK ${stocked}` : 'STOCK' },
    { id: 'gw.tab.2', label: build ? 'BUILD *' : 'BUILD' },
  ];
  if (!wide) tabs.unshift({ id: 'gw.tab.3', label: 'BOARD' });
  let tab = view.tab ?? 0;
  if (wide && tab === 3) tab = 0;
  const active = tabs.findIndex((t) => t.id === `gw.tab.${tab}`);

  let boardW = 0;
  if (wide) {
    boardW = dragWidth(ctx, sk, ui, input, view, 'splitBoard', area.x, 10, Math.min(Math.max(area.w * 0.5, 300), area.w - 360), Math.min(240, area.w - 360), area.w - 360, area.h, area.y);
    const rig = tab === 2 && build?.board ? { rig: build, prefix: 'gw.bslot', sel: view.bld?.pick } : {};
    drawBoard(ctx, sk, { x: area.x, y: area.y, w: boardW, h: area.h }, game, ui, input, events, view, rig);
  }
  const right = wide ? { x: area.x + boardW + 10, y: area.y, w: area.w - boardW - 10, h: area.h } : area;
  segmented(ctx, sk, ui, input, events, { x: right.x, y: right.y, w: right.w, h: 30 }, tabs, active);
  const panel = { x: right.x, y: right.y + 38, w: right.w, h: Math.max(right.h - 38, 60) };
  if (tab === 3) drawBoard(ctx, sk, panel, game, ui, input, events, view);
  else if (tab === 1) drawStock(ctx, sk, panel, game, ui, input, events, view);
  else if (tab === 2) drawBuild(ctx, sk, panel, game, ui, input, events, view);
  else drawInspector(ctx, sk, panel, game, ui, input, events, view);
}
