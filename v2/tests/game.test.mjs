// The core loop: a job from the board through to the pay-out.
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent } from '../game/data/content.js';
import { makeGame } from '../game/state/gameState.js';
import { storage, bandwidth } from '../game/state/gateway.js';
import { spawnContract } from '../game/state/contractSpawn.js';
import { mapHosts } from '../game/state/mapQuery.js';
import { acceptContract, submitContract, evaluateMissions } from '../game/state/contracts.js';
import { connect, disconnect, sessionTick } from '../game/systems/sessionTick.js';
import { startTask } from '../game/systems/sessionTasks.js';
import { tick } from '../game/systems/tick.js';

await initContent();

test('a job can be taken, done and paid', () => {
  const g = makeGame('TEST', 7);
  const offered = g.contracts.filter((c) => c.state === 'offered');
  assert.ok(offered.length >= 4, 'the board is stocked');
  const c = offered[0];
  assert.equal(c.kind, 'retrieve', 'the starter phase only hands out retrievals');
  assert.ok(acceptContract(g, c.id));

  assert.equal(connect(g, c.target), null);
  for (let i = 0; i < 300 && g.session.phase !== 'online'; i += 1) tick(g, 1 / 60);
  assert.equal(g.session.phase, 'online');

  // the file that the job wants
  const h = g.world.hosts[c.target];
  const fi = h.files.findIndex((f) => f.name === c.file);
  assert.ok(fi >= 0, 'the target holds the file');
  assert.equal(h.files[fi].enc, 0, 'the starter payload is plain');
  assert.equal(startTask(g, 'CopyFile', fi), null);

  // a 1 Gbps field rig takes 40 s over the biggest of the first files
  for (let i = 0; i < 3600; i += 1) {
    tick(g, 1 / 60);
    if (!g.session) break;
  }
  evaluateMissions(g);
  const done = g.contracts.find((x) => x.id === c.id);
  assert.equal(done.state, 'ready', `the copied file completes the job (${done.state})`);
  const before = g.player.credits;
  assert.equal(submitContract(g, c.id), null);
  assert.ok(g.player.credits > before, 'the job pays');
  disconnect(g);
  assert.equal(g.session, null);
});

test('an offered contract names a machine that is on the map', () => {
  const g = makeGame('TEST', 7);
  const onMap = new Set(mapHosts(g, { kind: 'all', query: '' }).map((h) => h.id));
  const offered = g.contracts.filter((c) => c.state === 'offered');
  assert.ok(offered.length >= 4, 'the board is stocked');
  offered.forEach((c) => {
    assert.ok(onMap.has(c.target), `contract ${c.id} points at a host on the map`);
  });
});

test('the gateway numbers follow what is fitted', async () => {
  const g = makeGame('TEST', 7);
  const lanes1 = g.player.gateway.parts.filter((p) => p.kind === 'cpu').length;
  assert.ok(lanes1 >= 1);
  // the drive and the uplink come with the chassis; there is no RAM part
  assert.ok(!g.player.gateway.parts.some((p) => p.kind === 'ram'));
  const gwy = g.player.gateway;
  assert.ok(storage(gwy) > 0 && bandwidth(gwy) > 0);
});
