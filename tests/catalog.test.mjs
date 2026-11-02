// The Modern Uplink hardware catalog (M1): seven chassis, parts without RAM,
// onboard storage and uplink, security parts that add up, and old saves that
// are refunded. Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent, chassis, componentsOf } from '../src/data/content.js';
import { HW_KINDS } from '../src/data/enums.js';
import { makeGame } from '../src/state/gameState.js';
import { buyComponent } from '../src/state/economy.js';
import * as gw from '../src/state/gateway.js';
import { saveRun, loadRun } from '../src/state/save.js';

await initContent();

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

/// A run on a chassis with enough money, nothing but the starter compute fitted.
function rig(tier) {
  const g = makeGame('CATALOG', 7);
  g.player.gateway.chassis = tier;
  g.player.credits = 1e9;
  return g;
}

test('there are seven chassis and four kinds of part, and no RAM', () => {
  assert.deepEqual(chassis().map((c) => c.tier), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(chassis().map((c) => c.price), [0, 6500, 14000, 32000, 48000, 75000, 120000]);
  assert.deepEqual(HW_KINDS, ['cpu', 'storage', 'modem', 'security']);
  assert.equal(componentsOf('ram').length, 0);
});

test('a new run starts on the Pelican with one compute part', () => {
  const g = makeGame('CATALOG', 7);
  assert.equal(g.player.gateway.chassis, 1);
  assert.deepEqual(g.player.gateway.parts.map((p) => p.kind), ['cpu']);
  assert.equal(g.version, 2);
});

test('storage and bandwidth are the onboard figure plus the fitted parts', () => {
  const g = makeGame('CATALOG', 7);
  const c = gw.chassisOf(g.player.gateway);
  assert.equal(gw.storage(g.player.gateway), c.onboard_storage);
  assert.equal(gw.bandwidth(g.player.gateway), c.onboard_uplink);
  g.player.gateway.parts.push({ kind: 'storage', level: 1 }, { kind: 'modem', level: 2 });
  assert.equal(gw.storage(g.player.gateway), c.onboard_storage + 4096);
  assert.equal(gw.bandwidth(g.player.gateway), c.onboard_uplink + 2500);
});

test('every part can be bought on a rack chassis that has room for it', () => {
  ['cpu', 'storage', 'modem', 'security'].forEach((kind) => {
    componentsOf(kind).forEach((def) => {
      const g = rig(4);
      assert.equal(buyComponent(g, def), null, `${def.name}`);
    });
  });
});

test('a ZFS enclosure needs a rack chassis, and the Pelican has no room for security', () => {
  const zfs = componentsOf('storage').find((d) => d.needs_rack);
  assert.match(gw.fitPlan(rig(2).player.gateway, zfs).why, /rack/);
  assert.equal(gw.fitPlan(rig(4).player.gateway, zfs).why, '');
  const sensors = componentsOf('security')[0];
  assert.ok(gw.fitPlan(rig(1).player.gateway, sensors).why, 'no defense slot on the Pelican');
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

test('a run saved on the old catalog is refunded at the old prices and put on a Pelican', () => {
  const g = makeGame('CATALOG', 9);
  g.version = 1;
  g.player.credits = 1000;
  g.player.gateway = {
    chassis: 3, ip: g.player.gateway.ip, migrateUntil: 0,
    parts: [{ kind: 'cpu', level: 3 }, { kind: 'ram', level: 2 }, { kind: 'ram', level: 2 }, { kind: 'storage', level: 4 }, { kind: 'modem', level: 2 }, { kind: 'security', level: 1 }],
  };
  g.player.stock = [{ kind: 'ram', level: 1, name: 'old', pct: 40, value: 300 }];
  const hosts = g.world.hosts.length;
  saveRun(g);
  const loaded = loadRun('CATALOG');
  // cpu 26000 + 2 x ram 3200 + storage 18000 + modem 6400 + security 1800 + chassis 48000 + stock 300
  assert.equal(loaded.player.credits, 1000 + 26000 + 6400 + 18000 + 6400 + 1800 + 48000 + 300);
  assert.equal(loaded.player.gateway.chassis, 1);
  assert.deepEqual(loaded.player.gateway.parts.map((p) => p.kind), ['cpu']);
  assert.deepEqual(loaded.player.stock, []);
  assert.equal(loaded.version, 2);
  assert.equal(loaded.world.hosts.length, hosts, 'the world is kept');
});
