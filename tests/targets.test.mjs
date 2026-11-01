// The board: the first jobs land on soft hosts, and every job the board
// offers can actually be finished.
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent } from '../src/data/content.js';
import { makeGame } from '../src/state/gameState.js';
import { onMinutes } from '../src/systems/clockTick.js';
import { storage } from '../src/state/gateway.js';

await initContent();

const SEEDS = [1, 3, 7, 11, 42, 99];

test('every world keeps a soft host with a file a fresh gateway can take', () => {
  SEEDS.forEach((seed) => {
    const g = makeGame('TEST', seed);
    const soft = g.world.hosts.filter((h) => h.company !== null && h.company !== undefined
      && h.firewall === 0 && h.monitor === 0 && h.proxy === 0
      && h.files.some((f) => !f.deleted && f.enc === 0 && f.size <= storage(g.player.gateway)));
    assert.ok(soft.length > 0, `seed ${seed} has a soft host to work on`);
  });
});

test('the first jobs only land on hosts with no guard at all', () => {
  SEEDS.forEach((seed) => {
    const g = makeGame('TEST', seed);
    const offered = g.contracts.filter((c) => c.state === 'offered');
    assert.ok(offered.length >= 4, 'the board is stocked');
    offered.forEach((c) => {
      const h = g.world.hosts[c.target];
      assert.equal(h.firewall, 0, `contract ${c.id} target has no firewall`);
      assert.equal(h.monitor, 0, `contract ${c.id} target has no monitor`);
      assert.equal(h.proxy, 0, `contract ${c.id} target has no proxy`);
      assert.equal(c.difficulty, 1, `contract ${c.id} is an easy job`);
    });
  });
});

test('the board only offers jobs the operator can finish', () => {
  const g = makeGame('TEST', 7);
  g.player.rating = 25;
  g.stats.missionsDone = 1;
  g.contracts = []; // let the board refill at this standing
  for (let m = 0; m < 2880; m += 30) onMinutes(g, 30);
  const offered = g.contracts.filter((c) => c.state === 'offered');
  assert.ok(offered.length > 0, 'the board is stocked');
  offered.forEach((c) => {
    assert.ok(['retrieve', 'delete', 'destroy', 'modify'].includes(c.kind), `contract ${c.id} is a kind with a task`);
    if (c.kind !== 'retrieve') return;
    const h = g.world.hosts[c.target];
    const f = h.files.find((x) => x.name === c.file);
    assert.ok(f, `contract ${c.id} names a file on the host`);
    assert.equal(f.enc, 0, `contract ${c.id} names a plain file`);
    assert.ok(f.size <= storage(g.player.gateway), `contract ${c.id} names a file the gateway can hold`);
  });
});
