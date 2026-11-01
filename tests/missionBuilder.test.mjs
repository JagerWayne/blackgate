// The MISSION BUILDER: a cheat window that posts a job built to order.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent } from '../src/data/content.js';
import { makeGame, keepsRecord } from '../src/state/gameState.js';
import { generateCustomContract } from '../src/state/contractSpawn.js';
import { targetsFor } from '../src/state/contractTarget.js';
import { makeInput, endFrame } from '../src/systems/input.js';
import { frameKeys } from '../src/systems/hotkeys.js';
import { makeUiState } from '../src/ui/kit.js';
import { makeWindows, openWindow, findWindow, WINDOWS } from '../src/state/windows.js';
import { drawPlay, desktop } from '../src/render/play.js';
import { handleEvents } from '../src/systems/events.js';
import { theme } from '../src/core/theme.js';
import { stubCtx } from './stubCanvas.mjs';

await initContent();
const W = 1600;
const H = 900;
const DESK = desktop(W, H);

function playState() {
  return {
    view: { w: W, h: H }, wallpaper: null, input: makeInput(), ui: makeUiState(),
    windows: makeWindows(), game: makeGame('BUILD', 7), win: {}, mode: 'play', time: 0,
  };
}
function frame(state) {
  frameKeys(state);
  const events = [];
  const ctx = stubCtx();
  drawPlay(ctx, theme(), W, H, state, events);
  handleEvents(state, events, DESK);
  endFrame(state.input);
  return ctx.texts.map((t) => t.s);
}
const send = (state, e) => handleEvents(state, [e], DESK);
const click = (state, id) => send(state, { type: 'click', id });
const edit = (state, id, value) => send(state, { type: 'edit', id, value });

// -- the engine: every setting can be set ------------------------------------------------

test('a job can be built with its own target, file, payout, deadline, client and brief', () => {
  const g = makeGame('BUILD', 7);
  const h = g.world.hosts[targetsFor(g, 'retrieve', { anyGuard: true })[0]];
  const f = h.files.find((x) => !x.deleted && x.tag === 0 && x.enc === 0 && x.size < 30);
  const now = g.clock.minutes;
  const c = generateCustomContract(g, {
    kind: 'retrieve', target: h.id, file: f.name, reward: 12345, hours: 6,
    client: 'ACME CORP', brief: 'Bring me {file} from {co}.', accept: true,
  });
  assert.ok(c);
  assert.equal(c.target, h.id);
  assert.equal(c.file, f.name);
  assert.equal(c.reward, 12345);
  assert.equal(c.deadline, now + 360);
  assert.equal(c.client, 'ACME CORP');
  assert.match(c.brief, new RegExp(`^Bring me \\{${f.name.replace('.', '\\.')}\\} from \\{`));
  assert.equal(c.state, 'accepted', 'taken straight away');
  const mail = g.mail.at(-1);
  assert.equal(mail.contract, c.id);
  assert.match(mail.body, /12345 cr/, 'the offer mail states the custom fee');
});

test('an ALTERATION can name its exact change, and a change the host cannot make is refused', () => {
  const g = makeGame('BUILD', 7);
  const h = g.world.hosts.find((x) => x.kind === 'gov' && x.company !== null && x.company !== undefined);
  const person = 3;
  const c = generateCustomContract(g, { kind: 'modify', target: h.id, record: { person, field: 'sex', value: g.world.people[person].sex === 'M' ? 'F' : 'M' } });
  assert.equal(c.record.person, person);
  assert.equal(c.record.field, 'sex');
  assert.equal(generateCustomContract(g, { kind: 'modify', target: h.id, record: { person, field: 'status', value: 'DECEASED' } }), null, 'government hosts do not keep vital status');
  assert.equal(generateCustomContract(g, { kind: 'modify', target: h.id, record: { person, field: 'sex', value: 'Q' } }), null, 'not a valid sex');
});

test('a file that is not on the host is refused', () => {
  const g = makeGame('BUILD', 7);
  const t = targetsFor(g, 'delete', { anyGuard: true })[0];
  assert.equal(generateCustomContract(g, { kind: 'delete', target: t, file: 'no_such_file.doc' }), null);
});

// -- the window ----------------------------------------------------------------------------

test('CHEATS opens the MISSION BUILDER, which is not in the Start menu', () => {
  const state = playState();
  click(state, 'cheat.missions');
  const win = findWindow(state.windows, 'missions');
  assert.ok(win);
  assert.equal(win.title, 'MISSION BUILDER');
  assert.ok(WINDOWS.find((w) => w.key === 'missions').hidden);
});

test('the builder draws every kind without trouble', () => {
  const state = playState();
  openWindow(state.windows, 'missions', DESK);
  for (const kind of ['retrieve', 'delete', 'destroy', 'modify']) {
    click(state, `mg.kind.${kind}`);
    const texts = frame(state);
    assert.ok(texts.includes('SPAWN MISSION'), kind);
  }
});

test('picking a host and a person in the builder, then SPAWN, posts that job', () => {
  const state = playState();
  const g = state.game;
  openWindow(state.windows, 'missions', DESK);
  click(state, 'mg.kind.modify');
  // the host picker lists the hosts that fit the kind; pick a government one
  click(state, 'mg.pick.host');
  frame(state);
  const view = state.win.missions;
  const at = view.pickOrder.findIndex((id) => g.world.hosts[id].kind === 'gov');
  send(state, { type: 'select', id: 'mg.list', index: at });
  const hostId = view.pickOrder[at];
  assert.equal(view.host, hostId);
  // then a person on it, a detail and a value
  click(state, 'mg.pick.person');
  frame(state);
  send(state, { type: 'select', id: 'mg.list', index: 0 });
  const person = view.person;
  assert.ok(keepsRecord(g, g.world.hosts[hostId], person, 'criminalRecord'));
  click(state, 'mg.field.criminalRecord');
  edit(state, 'mg.value', g.world.people[person].criminalRecord === 'CLEAN' ? 'FRAUD' : 'CLEAN');
  edit(state, 'mg.reward', '5000');
  click(state, 'mg.hours.24');
  edit(state, 'mg.client', 'THE BROKER');
  click(state, 'mg.spawn');
  const c = g.contracts.at(-1);
  assert.equal(c.kind, 'modify');
  assert.equal(c.target, hostId);
  assert.deepEqual([c.record.person, c.record.field], [person, 'criminalRecord']);
  assert.equal(c.reward, 5000);
  assert.equal(c.client, 'THE BROKER');
  assert.ok(g.toasts.some((t) => /posted/i.test(t.text)));
});

test('a bad setting says what is wrong instead of posting', () => {
  const state = playState();
  const g = state.game;
  openWindow(state.windows, 'missions', DESK);
  click(state, 'mg.kind.retrieve');
  edit(state, 'mg.reward', 'lots');
  const before = g.contracts.length;
  click(state, 'mg.spawn');
  assert.equal(g.contracts.length, before);
  assert.match(state.win.missions.msg, /payout/);
});
