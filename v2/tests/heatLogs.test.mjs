// A link leaves evidence: opening a connection writes a "session open" log
// with the gateway's address on the target and on every bounce hop. Logs stay
// until the operator scrubs or wipes them, and those left behind become heat.
// The visited-hosts report lists every machine the operator connected to.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent } from '../game/data/content.js';
import { makeGame } from '../game/state/gameState.js';
import { connect, disconnect } from '../game/systems/sessionTick.js';
import { startTask } from '../game/systems/sessionTasks.js';
import { tick } from '../game/systems/tick.js';
import { hostReport } from '../game/state/hostReport.js';

await initContent();

/// A run linked to a host with a small plain file, through two bounce hops.
function linked() {
  const g = makeGame('HEAT', 7);
  if (!g.player.tools.some((t) => t.kind === 'FileCopier')) g.player.tools.push({ kind: 'FileCopier', level: 1 });
  const h = g.world.hosts.find((x) => x.company !== null && x.files.some((f) => !f.deleted && f.enc === 0 && f.size < 30));
  g.player.bounce = g.world.hosts.filter((x) => x.relay && x.id !== h.id).slice(0, 2).map((x) => x.id);
  assert.equal(g.player.bounce.length, 2, 'the world has two relays to bounce through');
  assert.equal(connect(g, h.id), null);
  for (let i = 0; i < 5000 && g.session.phase !== 'online'; i += 1) tick(g, 1 / 60);
  const file = h.files.findIndex((f) => !f.deleted && f.enc === 0 && f.size < 30);
  return { g, h, file };
}
const mine = (g, host) => host.logs.filter((l) => l.ip === g.player.gateway.ip);

test('opening a link logs the gateway on the target and every hop', () => {
  const { g, h } = linked();
  assert.equal(mine(g, h).length, 1, 'the target logged the session');
  g.player.bounce.forEach((id) => assert.equal(mine(g, g.world.hosts[id]).length, 1, `hop ${id} logged the session`));
});

test('logs left behind on the route become heat', () => {
  const { g } = linked();
  disconnect(g);
  // target: 2 per log, each hop: 1.1 per log, times the chassis heat factor
  assert.ok(g.player.heat >= 2 + 2 * 1.1 - 1e-9, `heat ${g.player.heat}`);
});

test('a machine keeps its logs until they are erased', () => {
  const { g, h } = linked();
  disconnect(g);
  for (let i = 0; i < 60 * 120; i += 1) tick(g, 1 / 60); // two real minutes
  assert.equal(mine(g, h).length, 1, 'the log is still there');
});

test('the report lists visited hosts with logs, files and security', () => {
  const { g, h, file } = linked();
  assert.equal(startTask(g, 'CopyFile', file), null);
  for (let i = 0; i < 5000 && g.session.tasks.length; i += 1) tick(g, 1 / 60);
  disconnect(g);
  const r = hostReport(g);
  assert.equal(r.operator, 'HEAT');
  const ids = r.hosts.map((x) => x.ip);
  assert.ok(ids.includes(h.ip), 'the target is listed');
  g.player.bounce.forEach((id) => assert.ok(ids.includes(g.world.hosts[id].ip), 'each hop is listed'));
  assert.equal(r.hosts.length, 3, 'only visited hosts are listed');
  const t = r.hosts.find((x) => x.ip === h.ip);
  assert.deepEqual(Object.keys(t.security).sort(), ['firewall', 'monitor', 'proxy', 'trace']);
  assert.ok(t.logs.some((l) => l.mine && l.text === 'session open'));
  assert.ok(t.logs.some((l) => l.mine && l.text.startsWith('download ')));
  const f = t.files.find((x) => x.name === h.files[file].name);
  assert.equal(f.copied, true);
  assert.equal(f.deleted, false);
  assert.ok(Number.isFinite(t.firstVisit) && Number.isFinite(t.lastVisit));
  JSON.parse(JSON.stringify(r)); // plain JSON
});
