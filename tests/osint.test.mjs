// OSINT: profiles, phones and inboxes, and what each attack gets.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent } from '../src/data/content.js';
import { makeGame } from '../src/state/gameState.js';
import { connect } from '../src/systems/sessionTick.js';
import { tick } from '../src/systems/tick.js';
import { startTask } from '../src/systems/sessionTasks.js';
import { intelOf, knows, intelTick, phoneOf, PHISH_MINUTES, dossiers } from '../src/state/intel.js';
import { hasSample, voiceAdmin } from '../src/state/voice.js';
import { makeTerm, run } from '../src/systems/commands.js';

await initContent();

/// A run linked to a company host, with the tools at a level.
function linked(level = 5) {
  const g = makeGame('OSINT', 7);
  const kinds = ['OsintSweep', 'VoiceAnalyser', 'SpoofKit', 'CredentialStuff', 'PasswordCracker'];
  g.player.tools = g.player.tools.filter((t) => !kinds.includes(t.kind));
  kinds.forEach((kind) => g.player.tools.push({ kind, level }));
  const id = g.world.hosts.findIndex((h) => h.company !== undefined && h.company !== null && g.world.people.some((p) => p.company === h.company));
  assert.equal(connect(g, id), null);
  g.session.phase = 'online';
  const h = g.world.hosts[id];
  const staff = g.world.people.map((p, i) => i).filter((i) => g.world.people[i].company === h.company);
  return { g, h, staff };
}

const finish = (g) => { for (let n = 0; n < 400 && g.session.tasks.length; n += 1) tick(g, 0.25); };

test('PROFILE finds more the better the OSINT tool', () => {
  const { g, staff } = linked(2);
  const i = staff[0];
  assert.ok(!knows(g, i, 'email'));
  assert.equal(startTask(g, 'Profile', i), null);
  finish(g);
  assert.ok(knows(g, i, 'email') && knows(g, i, 'phone'));
  assert.ok(!knows(g, i, 'leak'), 'v2 does not reach leaked passwords');
  assert.match(startTask(g, 'Profile', i), /found all it can/);
  assert.ok(dossiers(g).includes(i), 'on file');
});

test('every phone and inbox attack needs the detail first', () => {
  const { g, staff } = linked();
  const i = staff[0];
  for (const kind of ['CallRecord', 'SpoofCall', 'TapPhone']) assert.match(startTask(g, kind, i), /phone unknown/, kind);
  for (const kind of ['HackInbox', 'Phish', 'Spam']) assert.match(startTask(g, kind, i), /email unknown/, kind);
});

test('a person of another company needs a link to their company', () => {
  const { g, h } = linked();
  const other = g.world.people.findIndex((p) => p.company !== h.company);
  assert.match(startTask(g, 'Profile', other), /link to a host of/);
});

test('a call records their voice; a tap opens a lock their clearance reaches', () => {
  const { g, staff } = linked();
  const i = staff.reduce((a, b) => (g.world.people[b].clearance > g.world.people[a].clearance ? b : a));
  intelOf(g, i).level = 4;
  assert.equal(startTask(g, 'SpoofCall', i), null);
  finish(g);
  assert.ok(hasSample(g, i));
  const mails = g.mail.length;
  assert.equal(startTask(g, 'TapPhone', i), null);
  finish(g);
  assert.ok(g.intel[i].tapped);
  assert.ok(g.mail.length > mails, 'the tap reports by mail');
});

test('a tap needs SPOOF KIT v2', () => {
  const { g, staff } = linked(1);
  intelOf(g, staff[0]).level = 2;
  assert.match(startTask(g, 'TapPhone', staff[0]), /SPOOF KIT v2/);
});

test('the leaked password opens the inbox, and the mail names the company', () => {
  const { g, staff } = linked();
  const i = staff[0];
  intelOf(g, i).level = 4;
  // this company logs in with a password alone; behind MFA stuffing is blocked (tests/mfa.test.mjs)
  g.world.hosts.forEach((h) => h.services.forEach((v) => { v.auth = 'password'; }));
  assert.equal(startTask(g, 'HackInbox', i), null);
  finish(g);
  assert.ok(g.intel[i].inbox);
  assert.ok(g.mail.some((m) => m.subject.startsWith('INTERCEPTED')));
  staff.forEach((j) => assert.ok(g.intel[j], 'colleagues become leads'));
});

test('a phish lands three hours later, the same way every time', () => {
  const { g, staff } = linked();
  const i = staff[0];
  intelOf(g, i).level = 1;
  assert.equal(startTask(g, 'Phish', i), null);
  finish(g);
  const it = g.intel[i];
  assert.notEqual(it.phishAt, undefined);
  const taken = it.phishTaken;
  intelTick(g);
  assert.notEqual(it.phishAt, undefined, 'not yet');
  g.clock.minutes += PHISH_MINUTES;
  intelTick(g);
  assert.equal(it.phishAt, undefined);
  assert.equal(!!it.inbox, taken);
  assert.ok(g.mail.some((m) => m.subject.startsWith(taken ? 'PHISH TAKEN' : 'PHISH IGNORED')));
});

test("spam on the host's admin slows the next link's trace", () => {
  const { g, h } = linked();
  const admin = voiceAdmin(g, h);
  const plain = linked();
  plain.g.session.phase = 'connecting';
  plain.g.session.connectT = plain.g.session.connectDur;
  tick(plain.g, 0.01);
  intelOf(g, admin).level = 1;
  assert.equal(startTask(g, 'Spam', admin), null);
  finish(g);
  g.session = null;
  assert.equal(connect(g, h.id ?? g.world.hosts.indexOf(h)), null);
  g.session.connectT = g.session.connectDur;
  tick(g, 0.01);
  assert.ok(g.session.traceRate < plain.g.session.traceRate, 'slower trace');
});

test('phones are worked out from the SSN', () => {
  const g = makeGame('OSINT', 7);
  const p = g.world.people[0];
  assert.match(phoneOf(p), /^\+1 \(\d{3}\) 55\d-\d{4}$/);
  assert.equal(phoneOf(p), phoneOf({ ...p }));
});

test('ppl commands profile and show a person', () => {
  const { g, staff } = linked();
  const state = { game: g, windows: { list: [], zTop: 10 }, win: {}, ui: {}, input: {}, view: { w: 1600, h: 900 } };
  const term = makeTerm();
  run(state, term, 'ppl staff', { x: 0, y: 0, w: 1600, h: 900 });
  run(state, term, 'ppl profile #1', { x: 0, y: 0, w: 1600, h: 900 });
  assert.equal(g.session.tasks[0].kind, 'Profile');
  finish(g);
  run(state, term, 'ppl show #1', { x: 0, y: 0, w: 1600, h: 900 });
  assert.ok(term.lines.some((l) => l.text.includes(g.world.people[staff[0]].email)));
});

test('DOSSIERS: a person can be removed from file, with a second press to confirm', async () => {
  const { handleEvents } = await import('../src/systems/events.js');
  const { intelOf, dossiers, learn, knows } = await import('../src/state/intel.js');
  const { makeGame } = await import('../src/state/gameState.js');
  const state = { game: makeGame('DEL', 3), win: {}, windows: { list: [] }, ui: {} };
  const g = state.game;
  intelOf(g, 4);
  learn(g, 4, 'email');
  assert.ok(dossiers(g).includes(4));
  handleEvents(state, [{ type: 'click', id: 'dos.del.4' }], { x: 0, y: 0, w: 1600, h: 900 });
  assert.ok(dossiers(g).includes(4), 'the first press only arms it');
  handleEvents(state, [{ type: 'click', id: 'dos.del.4' }], { x: 0, y: 0, w: 1600, h: 900 });
  assert.ok(!dossiers(g).includes(4), 'gone from file');
  assert.equal(knows(g, 4, 'email'), false, 'what was found is forgotten');
});
