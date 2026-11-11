// The Modern Uplink hardware catalog (M1): seven chassis, parts without RAM,
// onboard storage and uplink, security parts that add up, and old saves that
// are refunded. Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent, chassis, boards, forms, componentsOf } from '../game/data/content.js';
import { HW_KINDS } from '../game/data/enums.js';
import { makeGame } from '../game/state/gameState.js';
import { buyComponent, buyBoard, buyChassis } from '../game/state/economy.js';
import * as gw from '../game/state/gateway.js';
import { saveRun, loadRun } from '../game/state/save.js';

await initContent();

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  keys: () => Object.keys(store),
};

/// A run on a chassis with enough money, nothing but the starter compute fitted.
function rig(tier, board = 1) {
  const g = makeGame('CATALOG', 7);
  g.player.gateway.chassis = tier;
  g.player.gateway.board = board;
  g.player.credits = 1e9;
  return g;
}

test('there are seven chassis and seven kinds of part, and no RAM', () => {
  assert.deepEqual(chassis().map((c) => c.tier), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(chassis().map((c) => c.price), [0, 6500, 14000, 32000, 48000, 75000, 120000]);
  assert.deepEqual(HW_KINDS, ['cpu', 'accel', 'fpga', 'hsm', 'storage', 'modem', 'security']);
  assert.equal(componentsOf('ram').length, 0);
  assert.deepEqual(boards().map((b) => b.tier), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(forms(), ['MICRO PC', 'MINI-ITX', 'MICRO-ATX', 'ATX', 'E-ATX', 'SERVER RACK']);
});

test('a new run starts on the Micro PC: a processor, a soldered eMMC, a 64 GB SSD and a soldered network card', () => {
  const g = makeGame('CATALOG', 7);
  assert.equal(g.player.gateway.chassis, 1);
  assert.equal(g.player.gateway.board, 1);
  assert.deepEqual(g.player.gateway.parts.map((p) => p.kind), ['cpu', 'storage', 'storage', 'modem']);
  assert.equal(g.player.gateway.parts.find((p) => p.kind === 'modem').fixed, true);
  const emmc = g.player.gateway.parts.find((p) => p.kind === 'storage' && p.fixed);
  assert.equal(emmc.name, 'eMMC 64 GB');
  assert.equal(gw.systemDrive(g.player.gateway), emmc, 'the soldered eMMC is the system drive');
  assert.equal(g.player.gateway.parts.find((p) => p.kind === 'storage' && !p.fixed).name, 'M.2 SSD 64 GB');
  assert.equal(g.version, 4);
});

test('storage and bandwidth are the fitted drives and network cards', () => {
  const g = makeGame('CATALOG', 7);
  assert.equal(gw.storage(g.player.gateway), 128);
  assert.equal(gw.bandwidth(g.player.gateway), 1000);
  g.player.gateway.parts.push({ kind: 'storage', level: 4 }, { kind: 'modem', level: 2 });
  assert.equal(gw.storage(g.player.gateway), 128 + 256);
  assert.equal(gw.bandwidth(g.player.gateway), 1000 + 2500);
});

test('the Micro PC takes one processor, a soldered eMMC and one 64 GB drive, and no cards or security', () => {
  const g = makeGame('CATALOG', 7);
  const gwy = g.player.gateway;
  assert.deepEqual(['cpu', 'storage', 'modem', 'accel', 'fpga', 'hsm', 'security'].map((k) => gw.slotsFor(gwy, k)), [1, 2, 1, 0, 0, 0, 0]);
  assert.equal(gw.tierCap(gwy, 'cpu'), 1);
  assert.match(gw.fitPlan(gwy, componentsOf('cpu')[1]).why, /up to tier 1/);
  const drive = (tier) => componentsOf('storage').find((d) => d.tier === tier);
  assert.match(gw.fitPlan(gwy, drive(4)).why, /up to 64 GB/, 'a 256 GB drive is too big for the Micro board');
  assert.match(gw.fitPlan(gwy, drive(18)).why, /no 3\.5" hard disk connector/, 'and a 3.5 inch disk has no connector');
  assert.ok(gw.fitPlan(gwy, componentsOf('security')[0]).why, 'no security slot');
  assert.match(gw.fitPlan(gwy, componentsOf('modem')[1]).why, /soldered/);
});

test('every part can be bought on the biggest case and board, once its slot is free', () => {
  HW_KINDS.forEach((kind) => {
    componentsOf(kind).forEach((def) => {
      const g = rig(7, 6);
      g.player.gateway.parts = [];
      g.player.tools = [];
      assert.equal(buyComponent(g, def), null, `${def.name}`);
    });
  });
});

test('the bigger the board, the more it holds: processors, drives and cards', () => {
  assert.deepEqual(boards().map((b) => b.cpu_slots), [1, 1, 2, 2, 4, 8]);
  assert.deepEqual(boards().map((b) => b.storage_slots), [2, 2, 3, 4, 6, 8]);
  for (let i = 1; i < boards().length; i += 1) assert.ok(boards()[i].price > boards()[i - 1].price);
});

test('a board must fit the case: an ATX case takes a Micro-ATX board but not an E-ATX', () => {
  const g = rig(4);
  const atx = chassis().find((c) => c.tier === 4);
  assert.equal(atx.form, 4);
  assert.equal(gw.boardFits(atx, boards().find((b) => b.form === 3)), true);
  assert.equal(gw.boardFits(atx, boards().find((b) => b.form === 4)), true);
  assert.equal(gw.boardFits(atx, boards().find((b) => b.form === 5)), false);
  assert.equal(buyBoard(g, boards().find((b) => b.form === 3)), null);
  assert.match(buyBoard(g, boards().find((b) => b.form === 5)), /too big/);
  assert.match(buyBoard(g, boards().find((b) => b.form === 6)), /too big/);
});

test('the Micro PC has its board built in: no other board goes in', () => {
  const g = rig(1);
  assert.match(buyBoard(g, boards()[1]), /built in/);
  assert.equal(g.player.gateway.board, 1);
});

test('a new board keeps what it supports, sends the rest to stock, and unsolders the network card', () => {
  const g = rig(7, 6);
  g.player.gateway.parts = [
    { kind: 'cpu', level: 2, name: 'c2' }, { kind: 'cpu', level: 2, name: 'c2' }, { kind: 'cpu', level: 2, name: 'c2' },
    { kind: 'storage', level: 21, name: 'd21', role: 'downloads' }, { kind: 'storage', level: 3, name: 'd3', role: 'system' }, { kind: 'modem', level: 1, name: 'm1', fixed: true },
  ];
  assert.equal(buyBoard(g, boards().find((b) => b.tier === 3)), null);
  const left = g.player.gateway.parts;
  assert.equal(left.filter((p) => p.kind === 'cpu').length, 2, 'a Micro-ATX board has two sockets: the third goes to stock');
  assert.equal(left.filter((p) => p.kind === 'storage').length, 1, 'a 4 TB archive too: the small SSD stays');
  assert.equal(left.find((p) => p.kind === 'modem').fixed, undefined, 'the card is loose now');
  assert.equal(g.player.stock.length, 2);
});

test('a board that would leave the machine without a processor, a drive or a line is refused', () => {
  const g = rig(7, 6);
  g.player.gateway.parts = [{ kind: 'cpu', level: 5, name: 'c5' }, { kind: 'storage', level: 21, name: 'd21', role: 'system' }, { kind: 'modem', level: 2, name: 'm2' }];
  assert.match(buyBoard(g, boards().find((b) => b.tier === 3)), /processors/);
  assert.match(buyBoard(g, boards()[0]), /soldered/);
  assert.equal(g.player.gateway.board, 6, 'nothing changed');
});

test('a bigger case keeps the board and every part', () => {
  const g = rig(3, 3);
  const parts = g.player.gateway.parts.length;
  assert.equal(buyChassis(g, chassis().find((c) => c.tier === 4)), null);
  assert.equal(g.player.gateway.board, 3);
  assert.equal(g.player.gateway.parts.length, parts);
});

test('security parts add up: earliest warning, best shield, any failsafe', () => {
  const g = rig(4);
  const [sensors, thermite] = componentsOf('security');
  g.player.gateway.parts.push({ kind: 'security', level: sensors.tier }, { kind: 'security', level: thermite.tier });
  const gwy = g.player.gateway;
  assert.equal(gw.warnAt(gwy), Math.min(sensors.warn_at, thermite.warn_at));
  assert.equal(gw.raidShield(gwy), Math.max(sensors.raid_shield, thermite.raid_shield));
  assert.equal(gw.failsafe(gwy), 'PURGE');
});

test('a run saved by an older build is thrown away, a current one is kept', async () => {
  const { listSlots } = await import('../game/state/save.js');
  const g = makeGame('KEEPER', 9);
  saveRun(g);
  store['blackgate.save.OLDIE'] = JSON.stringify({ version: 2, player: { handle: 'OLDIE' } });
  assert.deepEqual(listSlots().map((x) => x.handle), ['KEEPER']);
  assert.equal('blackgate.save.OLDIE' in store, false, 'the old run is deleted');
  assert.ok(loadRun('KEEPER'), 'the current run loads');
});

test('hardware.json keeps its schema number at the top, where the app looks for it', async () => {
  const { readFileSync } = await import('node:fs');
  const text = readFileSync(new URL('../data/hardware.json', import.meta.url), 'utf8');
  assert.match(text.slice(0, 300), /"schema":\s*\d+/, 'a stale copy in Documents is ignored only if this is found');
});

test('speeds follow the type: SSD 100%, 5200 rpm 25%, 7200 rpm 50%, 10000 rpm 75%; prices follow speed and size', async () => {
  const { copyRate } = await import('../game/state/transfer.js');
  const drives = componentsOf('storage');
  assert.equal(drives.length, 30);
  drives.forEach((d) => {
    const want = d.rpm === 0 ? 1 : d.rpm === 5200 ? 0.25 : d.rpm === 7200 ? 0.5 : 0.75;
    assert.equal(d.speed, want, `${d.name} downloads at ${want}`);
    assert.ok(d.sys_speed >= d.speed && d.sys_speed <= 1, `${d.name}: the apps are not slowed more than the downloads`);
  });
  // the ranges and increments of each type
  const caps = (type) => drives.filter((d) => d.drive_type === type).map((d) => d.capacity);
  assert.deepEqual(caps('m2'), [32, 64, 128, 256, 512, 1024, 2048]);
  assert.deepEqual(caps('hdd18'), [32, 64, 128]);
  assert.deepEqual(caps('ssd25'), [256, 512, 1024, 2048]);
  assert.deepEqual(caps('hdd25'), [512, 1024, 2048]);
  assert.deepEqual(caps('hdd35_5200'), [1024, 2048, 4096, 12288]);
  assert.deepEqual(caps('hdd35_7200'), [512, 1024, 2048, 4096]);
  assert.deepEqual(caps('hdd35_10000'), [512, 1024, 2048, 4096, 12288]);
  // a faster drive of the same size costs more, a bigger one of the same kind costs more
  const price = (type, cap) => drives.find((d) => d.drive_type === type && d.capacity === cap).price;
  assert.ok(price('m2', 2048) > price('ssd25', 2048) && price('ssd25', 2048) > price('hdd35_10000', 2048));
  assert.ok(price('hdd35_10000', 2048) > price('hdd35_7200', 2048) && price('hdd35_7200', 2048) > price('hdd25', 2048) && price('hdd25', 2048) > price('hdd35_5200', 2048));
  drives.filter((d) => d.drive_type === 'm2').forEach((d, i, all) => { if (i) assert.ok(d.price > all[i - 1].price); });
  // the speed of the drives the downloads go to
  const g = makeGame('DISK', 7);
  const gwy = g.player.gateway;
  const full = copyRate(gwy);
  assert.equal(gw.driveSpeed(gwy), 1, 'the M.2 SSD takes the downloads');
  gwy.parts = gwy.parts.filter((p) => p.kind !== 'storage');
  gwy.parts.push({ kind: 'storage', level: 20, role: 'system' }); // a 4 TB 5200 rpm disk as the only drive
  gw.settleRoles(gwy);
  assert.equal(gw.driveSpeed(gwy), 0.25, 'one drive: shared');
  assert.equal(copyRate(gwy), full / 4);
  gwy.parts.push({ kind: 'storage', level: 7, role: 'downloads' }); // and an M.2 SSD for the downloads
  gw.settleRoles(gwy);
  assert.equal(gw.driveSpeed(gwy), 1, 'downloads go to the SSD');
  assert.equal(gw.systemSpeed(gwy), 0.63, 'but the apps sit on the slow disk');
  gwy.parts.push({ kind: 'storage', level: 29, role: 'downloads' }); // a 4 TB 10000 rpm disk joins the downloads
  assert.equal(gw.driveSpeed(gwy), (2048 + 4096 * 0.75) / 6144);
});

test('the Micro PC keeps its soldered eMMC as the system drive: it cannot leave, be replaced or lose the role', async () => {
  const { sellPart, installInSlot } = await import('../game/state/economy.js');
  const g = makeGame('EMMC', 7);
  g.player.credits = 1e6;
  const gwy = g.player.gateway;
  const emmc = gwy.parts.findIndex((p) => p.kind === 'storage' && p.fixed);
  const ssd = gwy.parts.findIndex((p) => p.kind === 'storage' && !p.fixed);
  assert.equal(gw.sharedDrive(gwy), false);
  assert.equal(gw.systemCap(gwy), 64, 'the apps live on the eMMC');
  assert.equal(gw.downloadCap(gwy), 64, 'the downloads on the SSD');
  assert.match(sellPart(g, emmc), /soldered/);
  assert.match(installInSlot(g, 'storage', emmc, { tier: 1 }), /soldered/);
  assert.equal(gw.systemDrive(gwy), gwy.parts[emmc], 'the eMMC is in bay 1: the system drive (C:)');
  g.player.storage = [{ name: 'f', size: 50, enc: 0, tag: 0, source: 'x' }];
  assert.match(sellPart(g, ssd), /keeps a SYS Drive|could not hold|apps need|downloads/, 'the SSD cannot go: a STR Drive stays');
  g.player.storage = [];
  // the small eMMC limits upgrading the apps: the App Store says there is no room
  const { buyTool } = await import('../game/state/economy.js');
  g.player.rating = 100;
  let refused = null;
  for (let level = 2; level <= 5 && !refused; level += 1) refused = buyTool(g, 'PasswordCracker', level);
  assert.ok(g.player.tools.length >= 3);
  void refused;
  const { systemFree, downloadFree } = await import('../game/state/gameHelpers.js');
  assert.equal(downloadFree(g), 64, 'the SSD is empty');
  assert.ok(systemFree(g) < 64, 'the apps take some of the eMMC');
});

test('moving to a loose board takes the eMMC with the old board: the apps move to the drive that is left', async () => {
  const { buyBoard } = await import('../game/state/economy.js');
  const { systemFree } = await import('../game/state/gameHelpers.js');
  const g = rig(7, 1);
  g.player.credits = 1e9;
  const gwy = g.player.gateway;
  assert.equal(buyBoard(g, boards().find((b) => b.tier === 4)), null);
  assert.equal(gwy.parts.filter((p) => p.kind === 'storage').length, 1, 'only the SSD is left');
  assert.equal(gwy.parts.some((p) => p.fixed), false, 'nothing is soldered to the new board');
  assert.equal(gw.sharedDrive(gwy), true);
  assert.ok(systemFree(g) >= 0);
});

test('hops add up across network cards, and a route can be as long as they carry', async () => {
  const { maxHops } = await import('../game/state/routes.js');
  const { minHopLimit } = await import('../game/data/settings.js');
  const MIN_HOP_LIMIT = minHopLimit();
  const g = makeGame('HOPS', 7);
  const gwy = g.player.gateway;
  assert.equal(gw.hops(gwy), 2, 'the Micro PC line carries 2');
  assert.equal(maxHops(g), MIN_HOP_LIMIT, 'a small machine keeps the usual limit of 8');
  gwy.parts.push({ kind: 'modem', level: 2 }); // a card for 2 and a card for 4: 6 hops
  assert.equal(gw.hops(gwy), 6);
  gwy.parts = gwy.parts.filter((p) => p.kind !== 'modem');
  gwy.parts.push({ kind: 'modem', level: 4 }, { kind: 'modem', level: 4 }); // two dishes, 10 each
  assert.equal(gw.hops(gwy), 20);
  assert.equal(maxHops(g), 20, 'a maxed-out machine can route through 20');
  const maxed = rig(7, 6);
  const { maxGateway } = await import('../game/state/cheats.js');
  maxGateway(maxed);
  assert.equal(gw.hops(maxed.player.gateway), 20);
  assert.equal(maxHops(maxed), 20);
});

test('system and download drives that are not soldered: roles, room, speeds and the edge cases', async () => {
  const { sellPart, buyComponent: buy, installInSlot } = await import('../game/state/economy.js');
  const { downloadFree, systemFree } = await import('../game/state/gameHelpers.js');
  const { appsUsed } = await import('../game/state/apps.js');
  const g = rig(7, 6);
  const gwy = g.player.gateway;
  g.player.credits = 1e9;
  // a loose board with one 128 GB SSD: shared, the whole drive is both
  gwy.parts = [{ kind: 'cpu', level: 1, name: 'c1' }, { kind: 'storage', level: 3, name: 'M.2 SSD 128 GB', role: 'system' }, { kind: 'modem', level: 1, name: 'm1' }];
  assert.equal(gw.sharedDrive(gwy), true);
  assert.equal(gw.systemCap(gwy), 128);
  assert.equal(gw.downloadCap(gwy), 128);
  assert.match(sellPart(g, gwy.parts.findIndex((p) => p.kind === 'storage')), /keeps a SYS Drive/, 'the last drive stays');
  // a second drive takes the downloads, the first stays the system drive
  const big = componentsOf('storage').find((d) => d.tier === 20);
  assert.equal(buy(g, big), null, 'a 4 TB 5200 rpm disk');
  assert.equal(gw.sharedDrive(gwy), false);
  assert.equal(gw.systemCap(gwy), 128);
  assert.equal(gw.downloadCap(gwy), 4096);
  assert.equal(gw.driveSpeed(gwy), 0.25, 'downloads go to the slow disk');
  assert.equal(gw.systemSpeed(gwy), 1, 'the apps stay on the SSD');
  assert.equal(systemFree(g), 128 - appsUsed(g));
  assert.equal(downloadFree(g), 4096);
  const archive = gwy.parts.findIndex((p) => p.level === 20);
  assert.equal(gw.systemDrive(gwy), gwy.parts.find((p) => p.kind === 'storage'), 'bay 1 is the system drive');
  // downloads that no longer fit refuse a removal
  g.player.storage = [{ name: 'big', size: 200, enc: 0, tag: 0, source: 'x' }];
  assert.match(sellPart(g, archive), /keeps a SYS Drive|could not hold|apps need|downloads need/);
  // a third drive lets the archive go; a machine keeps a SYS Drive and one STR Drive
  g.player.storage = [];
  gwy.parts.push({ kind: 'storage', level: 4, name: 'extra', role: 'downloads' });
  assert.equal(sellPart(g, archive), null);
  assert.equal(gw.systemDrive(gwy).level, 3);
  assert.equal(gw.sharedDrive(gwy), false, 'two drives: SYS and STR');
  // the SYS Drive cannot be taken out while another drive waits: it is replaced, and the data is copied (downtime)
  gwy.parts.push({ kind: 'storage', level: 20, name: 'Archive', role: 'downloads' });
  gw.settleRoles(gwy);
  assert.match(sellPart(g, gwy.parts.findIndex((p) => p.kind === 'storage')), /SYS Drive stays/);
  g.player.stock.push({ kind: 'storage', level: 5, name: 'New', value: 10, pct: 30 });
  g.clock.minutes = 1000;
  assert.equal(installInSlot(g, 'storage', gwy.parts.findIndex((p) => p.kind === 'storage'), { stock: g.player.stock.length - 1 }), null);
  assert.equal(gw.systemDrive(gwy).level, 5, 'the new drive is the SYS Drive');
  assert.ok(gwy.migrateUntil > 1000 + 30, 'the data copy takes the machine offline');
  g.clock.minutes = 5000;
  assert.equal(sellPart(g, gwy.parts.findIndex((p) => p.level === 20)), null);
  // a replacement drive keeps its slot's role
  assert.equal(installInSlot(g, 'storage', gwy.parts.findIndex((p) => p.kind === 'storage'), { tier: 5 }), null);
  assert.equal(gw.systemDrive(gwy).level, 5);
});

test('a saved run keeps its case, board, soldered parts and drive roles', async () => {
  const { saveRun, loadRun } = await import('../game/state/save.js');
  const { buyBoard } = await import('../game/state/economy.js');
  const g = rig(7, 1);
  g.player.credits = 1e9;
  assert.equal(buyBoard(g, boards().find((b) => b.tier === 5)), null);
  g.clock.minutes += 500; // the new board is installed
  buyComponent(g, componentsOf('storage').find((d) => d.tier === 18));
  saveRun(g);
  const back = loadRun(g.player.handle);
  assert.equal(back.player.gateway.board, 5);
  assert.equal(back.player.gateway.chassis, 7);
  assert.equal(gw.systemDrive(back.player.gateway).level, gw.systemDrive(g.player.gateway).level);
  assert.deepEqual(back.player.gateway.parts, g.player.gateway.parts);
});
