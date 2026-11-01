// The command prompt: the parser, every app's commands, and that a command
// does exactly what its button does.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent } from '../src/data/content.js';
import { makeGame } from '../src/state/gameState.js';
import { makeInput } from '../src/systems/input.js';
import { makeUiState } from '../src/ui/kit.js';
import { makeWindows, openWindow, findWindow } from '../src/state/windows.js';
import { drawPlay, desktop } from '../src/render/play.js';
import { handleEvents } from '../src/systems/events.js';
import { connect } from '../src/systems/sessionTick.js';
import { theme } from '../src/core/theme.js';
import { words, makeTerm, run, complete, commandNames, GENERAL_NAMES } from '../src/systems/commands.js';
import { runPending } from '../src/windows/terminal.js';
import { stubCtx } from './stubCanvas.mjs';

await initContent();
const W = 1600;
const H = 900;
const DESK = desktop(W, H);

function setup(seed = 7) {
  const state = {
    view: { w: W, h: H }, wallpaper: null, input: makeInput(), ui: makeUiState(),
    windows: makeWindows(), game: makeGame('CMD', seed), win: {}, mode: 'play', time: 0,
  };
  const term = makeTerm();
  // runs a line and returns only what it printed
  const say = (line) => {
    const from = term.lines.length;
    run(state, term, line, DESK);
    return term.lines.slice(from);
  };
  const last = (line) => say(line).at(-1);
  return { state, term, say, last, game: state.game };
}

test('words keep quoted text together', () => {
  assert.deepEqual(words('bg alter "Ana Diaz" status deceased'), ['bg', 'alter', 'Ana Diaz', 'status', 'deceased']);
  assert.deepEqual(words('  mail   read new '), ['mail', 'read', 'new']);
});

test('help lists every visible app, and every app has commands with help text', () => {
  const { say } = setup();
  const text = say('help').map((l) => l.text).join('\n');
  for (const app of ['mail', 'contracts', 'map', 'blackgate', 'gateway', 'software', 'storage', 'bank', 'news', 'operator', 'system', 'notepad']) {
    assert.ok(text.includes(app), app);
    const lines = say(`help ${app}`);
    assert.ok(lines.length > 2, `${app} has commands`);
  }
  assert.ok(!text.includes('cheat'), 'the cheat commands stay out of plain help');
  const names = commandNames();
  Object.values(names).forEach((verbs) => assert.ok(verbs.length > 0));
  assert.ok(GENERAL_NAMES.includes('help') && GENERAL_NAMES.includes('exit'));
});

test('a mistake says what went wrong', () => {
  const { last } = setup();
  assert.equal(last('frobnicate').tone, 'err');
  assert.match(last('ct accept').text, /name a contract/);
  assert.match(last('ct accept 99999').text, /no contract/);
  assert.match(last('mail fly').text, /./);
  assert.match(last('bg copy x').text, /not connected/);
});

test('ct accept does what the ACCEPT button does', () => {
  const a = setup();
  const b = setup();
  const offer = a.game.contracts.find((c) => c.state === 'offered');
  assert.ok(offer, 'a new run has an offer');
  a.say(`ct accept ${offer.id}`);
  handleEvents(b.state, [{ type: 'click', id: `ct.accept.${offer.id}` }], DESK);
  const pick = (g) => g.contracts.find((c) => c.id === offer.id).state;
  assert.equal(pick(a.game), pick(b.game));
  assert.equal(pick(a.game), 'accepted');
});

test('#n picks a row from the last list', () => {
  const { say, game } = setup();
  const rows = say('ct list');
  assert.ok(rows.length > 1);
  const first = game.contracts[0];
  say('ct accept #1');
  assert.equal(first.state, 'accepted');
});

test('mail read new marks the oldest unread message read', () => {
  const { say, game } = setup();
  game.mail.forEach((m) => { m.read = true; });
  game.mail.push({ id: 900, from: 'A <a@x>', subject: 'old', body: 'one', minute: 1, read: false });
  game.mail.push({ id: 901, from: 'B <b@x>', subject: 'new', body: 'two', minute: 5, read: false });
  const out = say('mail read new');
  assert.ok(out.some((l) => l.text.includes('old')));
  assert.equal(game.mail.find((m) => m.id === 900).read, true);
  assert.equal(game.mail.find((m) => m.id === 901).read, false);
  say('mail readall');
  assert.ok(game.mail.every((m) => m.read));
});

test('bg copy starts the same task as the COPY button', () => {
  const { say, game } = setup();
  const c = game.contracts.find((x) => x.kind === 'retrieve' && x.file) ?? game.contracts[0];
  assert.equal(connect(game, c.target), null, 'the link opens');
  const h = game.world.hosts[c.target];
  h.services.forEach((s) => { s.open = true; });
  const file = h.files.find((f) => !f.deleted && f.enc === 0);
  assert.ok(file, 'a plain file to copy');
  say(`bg copy "${file.name}"`);
  assert.equal(game.session.tasks.length, 1);
  assert.equal(game.session.tasks[0].kind, 'CopyFile');
  assert.equal(game.session.tasks[0].arg, h.files.indexOf(file));
});

test('map route add and remove change the bounce route', () => {
  const { say, game } = setup();
  const relay = game.world.hosts.find((h) => h.discovered && h.kind === 'relay');
  say(`map route add ${relay.ip}`);
  assert.deepEqual(game.player.bounce, [relay.id]);
  assert.match(say(`map route add ${relay.ip}`).at(-1).text, /already in the route/);
  say(`map route remove ${relay.ip}`);
  assert.deepEqual(game.player.bounce, []);
});

test('gateway removals need --yes', () => {
  const { last, game } = setup();
  const before = game.player.gateway.parts.length;
  assert.match(last('gw remove #1').text, /--yes/);
  assert.equal(game.player.gateway.parts.length, before, 'nothing came out');
});

test('notepad write adds a line, and clear needs --yes', () => {
  const { say, game } = setup();
  say('notepad write "pass is hunter2"');
  assert.equal(game.notes, 'pass is hunter2');
  say('notepad clear');
  assert.equal(game.notes, 'pass is hunter2');
  say('notepad clear --yes');
  assert.equal(game.notes, '');
});

test('the cheat commands work and do not mark the run as cheated', () => {
  const { say, game } = setup();
  say('cheat money 50000');
  assert.equal(game.player.credits, 50000);
  say('cheat heat 40');
  assert.equal(Math.round(game.player.heat), 40);
  assert.ok(!game.cheated && !game.flags?.cheated);
});

test('open and close drive the windows; pause and resume drive the clock', () => {
  const { say, state, game } = setup();
  say('open mail');
  assert.ok(findWindow(state.windows, 'mail'));
  say('close mail');
  assert.ok(!findWindow(state.windows, 'mail'));
  say('pause');
  assert.equal(game.paused, true);
  say('resume');
  assert.equal(game.paused, false);
});

test('Tab completes commands, actions and arguments', () => {
  const { state } = setup();
  assert.equal(complete(state, 'ma').line, 'ma');
  assert.ok(complete(state, 'ma').hits.includes('mail') && complete(state, 'ma').hits.includes('map'));
  assert.equal(complete(state, 'mai').line, 'mail ');
  assert.equal(complete(state, 'mail rea').line, 'mail read');
  assert.equal(complete(state, 'bg bypass fi').line, 'bg bypass firewall ');
});

test('the window queues typed lines and runs them after the frame', () => {
  const { state } = setup();
  openWindow(state.windows, 'terminal', DESK);
  state.ui.focus = 'terminal';
  state.input.typed = 'whoami\n';
  drawPlay(stubCtx(), theme(), W, H, state, []);
  runPending(state, DESK);
  const lines = state.win.terminal.term.lines.map((l) => l.text);
  assert.ok(lines.includes('> whoami'));
  assert.ok(lines.some((t) => t.startsWith('CMD //')));
});
