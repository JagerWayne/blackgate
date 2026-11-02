// Voice locks: no breaker opens them; the admin's recording does.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent } from '../src/data/content.js';
import { makeGame } from '../src/state/gameState.js';
import { connect } from '../src/systems/sessionTick.js';
import { tick } from '../src/systems/tick.js';
import { startTask } from '../src/systems/sessionTasks.js';
import { voiceAdmin, hasSample } from '../src/state/voice.js';
import { intelOf } from '../src/state/intel.js';

await initContent();

/// A run linked to a voice-locked host, with every tool at its best.
function linked() {
  const g = makeGame('VOX', 7);
  const id = g.world.hosts.findIndex((h) => h.services.some((s) => s.kind === 'voice'));
  assert.ok(id >= 0, 'the world has a voice lock');
  g.player.tools = g.player.tools.filter((t) => t.kind !== 'VoiceAnalyser' && t.kind !== 'PasswordCracker');
  g.player.tools.push({ kind: 'VoiceAnalyser', level: 5 }, { kind: 'PasswordCracker', level: 5 });
  assert.equal(connect(g, id), null);
  g.session.phase = 'online';
  const h = g.world.hosts[id];
  return { g, h, svc: h.services.findIndex((s) => s.kind === 'voice') };
}

const finish = (g) => { for (let i = 0; i < 400 && g.session.tasks.length; i += 1) tick(g, 0.25); };

test('a breaker cannot open a voice lock', () => {
  const { g, svc } = linked();
  assert.match(startTask(g, 'CrackPassword', svc), /voice lock/);
});

test('the voiceprint needs the recording first', () => {
  const { g, svc } = linked();
  assert.match(startTask(g, 'PlayVoiceprint', svc), /record the admin/);
});

test('record the admin, then play it back: the lock opens', () => {
  const { g, h, svc } = linked();
  const who = voiceAdmin(g, h);
  assert.notEqual(who, null);
  assert.match(startTask(g, 'RecordVoice', svc), /phone is unknown/, 'the call needs the number');
  intelOf(g, who).level = 2;
  assert.equal(startTask(g, 'RecordVoice', svc), null);
  finish(g);
  assert.ok(hasSample(g, who), 'the recording is on the gateway');
  assert.match(startTask(g, 'RecordVoice', svc), /already recorded/);
  assert.equal(startTask(g, 'PlayVoiceprint', svc), null);
  finish(g);
  assert.equal(h.services[svc].open, true);
});

test('every task kind draws its animation, the same at the same moment', async () => {
  const { taskRow } = await import('../src/ui/taskFx.js');
  const { stubCtx } = await import('./stubCanvas.mjs');
  const { theme } = await import('../src/core/theme.js');
  const kinds = ['CrackPassword', 'DecryptFile', 'RecordVoice', 'PlayVoiceprint', 'BypassFirewall', 'CopyFile', 'DeleteFile', 'OsintSweep'];
  for (const kind of kinds) {
    const task = { kind, label: `${kind} x`, progress: 0.4, lane: 0 };
    const draw = () => {
      const ctx = stubCtx();
      taskRow(task, 3.2).draw(ctx, theme(), { x: 0, y: 0, w: 300, h: 58 });
      return JSON.stringify(ctx.texts);
    };
    assert.equal(draw(), draw(), kind);
    assert.match(draw(), /40%/, `${kind} shows its percent`);
  }
});

test('the screen effects run on a stub canvas, and the switches turn them off', async () => {
  const { drawFx } = await import('../src/render/fx.js');
  const { stubCtx } = await import('./stubCanvas.mjs');
  const { makeInput } = await import('../src/systems/input.js');
  const { g } = linked();
  g.session.alerted = true;
  g.session.trace = 0.9;
  const state = { game: g, input: makeInput(), time: 1 };
  assert.doesNotThrow(() => drawFx(stubCtx(), 800, 600, state, 0.016));
  g.settings.effects = false;
  g.settings.sound = false;
  assert.doesNotThrow(() => drawFx(stubCtx(), 800, 600, state, 0.016));
});
