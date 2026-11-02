// Person records: the fields an ALTERATION job changes.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { initContent, firstNames, lastNames } from '../src/data/content.js';
import { makeGame } from '../src/state/gameState.js';
import { saveRun, loadRun } from '../src/state/save.js';

await initContent();

// -- the names ---------------------------------------------------------------------

test('the name lists hold 200 first names (male and female) and 200 surnames, none repeated', () => {
  const first = firstNames();
  assert.equal(first.length, 200);
  assert.equal(new Set(first.map((f) => f.name)).size, 200);
  assert.deepEqual([...new Set(first.map((f) => f.sex))].sort(), ['F', 'M']);
  assert.equal(new Set(lastNames()).size, 200);
});

// -- Task 1: the record fields --------------------------------------------------------

const SSN = /^\d{3}-\d{2}-\d{4}$/;

test('every person has a sex, a vital status, a criminal record and an SSN', () => {
  const g = makeGame('REC', 7);
  for (const p of g.world.people) {
    assert.ok(['M', 'F'].includes(p.sex), p.name);
    assert.ok(['ACTIVE', 'DECEASED'].includes(p.status), p.name);
    assert.equal(typeof p.criminalRecord, 'string');
    assert.match(p.ssn, SSN);
    // the first name agrees with the sex it was drawn with
    const first = firstNames().find((f) => f.name === p.name.split(' ')[0]);
    assert.equal(first.sex, p.sex, p.name);
  }
  assert.equal(new Set(g.world.people.map((p) => p.ssn)).size, g.world.people.length, 'no SSN is shared');
});

test('both directions of a job exist: some people are deceased, some have a record', () => {
  const people = makeGame('REC', 7).world.people;
  assert.ok(people.some((p) => p.status === 'DECEASED'));
  assert.ok(people.some((p) => p.status === 'ACTIVE'));
  assert.ok(people.some((p) => p.criminalRecord !== 'CLEAN'));
  assert.ok(people.some((p) => p.criminalRecord === 'CLEAN'));
});

test('the same seed gives the same records', () => {
  const a = makeGame('REC', 7).world.people;
  const b = makeGame('REC', 7).world.people;
  assert.deepEqual(a, b);
});

test('the records draw nothing from the generator: the hosts of a seed are unchanged', () => {
  const g = makeGame('FP', 7);
  const s = JSON.stringify(g.world.hosts.map((h) => [h.ip, h.files.map((f) => f.name + f.size + f.enc), h.services.map((v) => v.password)]));
  // the fingerprint of seed 7's hosts before people had records
  assert.equal(createHash('sha1').update(s).digest('hex'), 'fd105a0e779852b14438977d38e3049ba9c19f20');
  assert.equal(g.world.people.length, 158);
});

test('a save whose people lack the fields loads with the same values a new world has', () => {
  const store = new Map();
  const saved = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  try {
    const g = makeGame('OLD', 7);
    const fresh = structuredClone(g.world.people);
    g.world.people.forEach((p) => { delete p.sex; delete p.status; delete p.criminalRecord; delete p.ssn; });
    assert.ok(saveRun(g));
    assert.deepEqual(loadRun().world.people, fresh);
  } finally {
    globalThis.localStorage = saved;
  }
});

// -- Task 2: the AlterRecord task -------------------------------------------------------

const { connect, sessionTick } = await import('../src/systems/sessionTick.js');
const { startTask, taskError } = await import('../src/systems/sessionTasks.js');

/// A live link to a host that holds a field: government hosts hold criminal
/// records, a health company's hosts hold vital status.
function linkTo(holds) {
  const g = makeGame('ALTER', 7);
  const h = g.world.hosts.find((x) => x.company !== null && x.company !== undefined && holds(g, x));
  assert.ok(h, 'the world has such a host');
  assert.equal(connect(g, h.id), null);
  g.session.phase = 'online';
  return { g, h };
}
const isGov = (g, h) => h.kind === 'gov';
const isHealth = (g, h) => g.world.companies[h.company].kind === 'health';
const openRecords = (h) => h.services.filter((v) => v.kind === 'records').forEach((v) => { v.open = true; });
function finish(g) {
  for (let i = 0; i < 200 && g.session.tasks.length; i += 1) sessionTick(g, 1);
  assert.equal(g.session.tasks.length, 0, 'the task finished');
}

test('a locked records service refuses the change', () => {
  const { g } = linkTo(isGov);
  const arg = { person: 0, field: 'criminalRecord', value: 'CLEAN' };
  assert.match(taskError(g, g.session, 'AlterRecord', arg), /records/);
});

test('a host that does not hold the field refuses the change', () => {
  const { g, h } = linkTo(isGov);
  openRecords(h);
  assert.match(taskError(g, g.session, 'AlterRecord', { person: 0, field: 'status', value: 'DECEASED' }), /not kept here/);
  const health = linkTo(isHealth);
  openRecords(health.h);
  assert.match(taskError(health.g, health.g.session, 'AlterRecord', { person: 0, field: 'criminalRecord', value: 'CLEAN' }), /not kept here/);
});

test('with access, a criminal record is cleared, loudly', () => {
  const { g, h } = linkTo(isGov);
  openRecords(h);
  const person = g.world.people.findIndex((p) => p.criminalRecord !== 'CLEAN');
  const arg = { person, field: 'criminalRecord', value: 'CLEAN' };
  const logs = h.logs.length;
  assert.equal(startTask(g, 'AlterRecord', arg), null);
  assert.equal(g.session.alerted, true, 'it trips the alarm');
  finish(g);
  assert.equal(g.world.people[person].criminalRecord, 'CLEAN');
  assert.equal(h.logs.length, logs + 1, 'it leaves a log');
  assert.ok(g.session.lines.some((l) => /record altered/.test(l)));
  assert.match(taskError(g, g.session, 'AlterRecord', arg), /already reads/);
});

test('with access, a person is marked deceased', () => {
  const { g, h } = linkTo(isHealth);
  openRecords(h);
  const person = g.world.people.findIndex((p) => p.status === 'ACTIVE');
  assert.equal(startTask(g, 'AlterRecord', { person, field: 'status', value: 'DECEASED' }), null);
  finish(g);
  assert.equal(g.world.people[person].status, 'DECEASED');
});

test('a value the field cannot hold is refused', () => {
  const { g, h } = linkTo(isHealth);
  openRecords(h);
  assert.match(taskError(g, g.session, 'AlterRecord', { person: 0, field: 'status', value: 'ZOMBIE' }), /not a valid/);
  assert.match(taskError(g, g.session, 'AlterRecord', { person: 99999, field: 'status', value: 'DECEASED' }), /no such person/);
});

// -- Task 3: ALTERATION jobs --------------------------------------------------------------

const { spawnContract } = await import('../src/state/contractSpawn.js');
const { acceptContract, submitContract } = await import('../src/state/contracts.js');
const { handleEvents } = await import('../src/systems/events.js');
const { recordsKept, keepsRecord, validRecord, recordText } = await import('../src/state/gameState.js');

/// A run at rating 8 with an ALTERATION job on the board.
function withAlteration() {
  const g = makeGame('JOBS', 7);
  g.player.rating = 8;
  g.stats.missionsDone = 1; // past the starter jobs
  let job = null;
  for (let i = 0; i < 300 && !job; i += 1) {
    const id = spawnContract(g);
    job = g.contracts.find((c) => c.id === id && c.kind === 'modify') ?? null;
  }
  assert.ok(job, 'an ALTERATION job was posted');
  return { g, job };
}

test('no ALTERATION job is posted below rating 8', () => {
  const g = makeGame('JOBS', 7);
  for (let i = 0; i < 200; i += 1) spawnContract(g);
  assert.ok(!g.contracts.some((c) => c.kind === 'modify'));
});

test('an ALTERATION job names a real change on a host that keeps that record', () => {
  const { g, job } = withAlteration();
  const { person, field, value } = job.record;
  const p = g.world.people[person];
  assert.ok(p, 'the person exists');
  assert.ok(validRecord(g, field, value));
  assert.notEqual(p[field], value, 'the record does not read that yet');
  assert.ok(keepsRecord(g, g.world.hosts[job.target], person, field), 'the target keeps the field');
  assert.ok(job.reward > 0);
  assert.match(job.brief, /CHANGE/);
  assert.ok(job.brief.includes(p.name), 'the brief names the person');
});

test('ALTER on the job\'s record finishes the job, and it pays on submit', () => {
  const { g, job } = withAlteration();
  assert.ok(acceptContract(g, job.id));
  const h = g.world.hosts[job.target];
  assert.equal(connect(g, h.id), null);
  g.session.phase = 'online';
  openRecords(h);
  const state = { game: g, win: {}, windows: { list: [] }, ui: {}, input: {} };
  handleEvents(state, [{ type: 'click', id: `sess.alter.${job.id}` }], { x: 0, y: 0, w: 800, h: 600 });
  assert.equal(g.session.tasks[0]?.kind, 'AlterRecord', 'the button starts the task');
  finish(g);
  assert.equal(job.state, 'ready');
  const credits = g.player.credits;
  assert.equal(submitContract(g, job.id), null);
  assert.equal(g.player.credits, credits + job.reward);
});

test('a live ALTERATION job survives loading; one from before records is put back', () => {
  const store = new Map();
  const saved = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  try {
    const { g, job } = withAlteration();
    acceptContract(g, job.id);
    const old = { ...job, id: 9999, record: undefined };
    g.contracts.push(old);
    assert.ok(saveRun(g));
    const back = loadRun();
    assert.equal(back.contracts.find((c) => c.id === job.id).state, 'accepted');
    assert.equal(back.contracts.find((c) => c.id === 9999).state, 'expired');
  } finally {
    globalThis.localStorage = saved;
  }
});

// -- Task 4: the RECORDS tab and the hints --------------------------------------------------

/// Draws one view and returns the texts it drew.
async function drawn(draw) {
  const { stubCtx } = await import('./stubCanvas.mjs');
  const { makeUiState } = await import('../src/ui/kit.js');
  const { makeInput } = await import('../src/systems/input.js');
  const { theme } = await import('../src/core/theme.js');
  const ctx = stubCtx();
  draw(ctx, theme(), makeUiState(), makeInput());
  return ctx.texts.map((t) => t.s);
}
/// A run with an ALTERATION job in hand and a link to its host.
function onTheJob() {
  const { g, job } = withAlteration();
  acceptContract(g, job.id);
  assert.equal(connect(g, job.target), null);
  g.session.phase = 'online';
  return { g, job, h: g.world.hosts[job.target] };
}
const BIG = { x: 0, y: 0, w: 1200, h: 4000 };

test('the JOB block names the change, and the ALTER button is no longer there', async () => {
  const { drawSession } = await import('../src/windows/session.js');
  const { g } = onTheJob();
  const texts = await drawn((ctx, sk, ui, input) => drawSession(ctx, sk, BIG, g, ui, input, [], {}));
  assert.ok(texts.some((t) => t.startsWith('CHANGE')), 'the change is shown');
  assert.ok(texts.includes('RECORDS'), 'the tab is there');
  assert.ok(!texts.some((t) => t.startsWith('ALTER')), 'no ALTER button in the JOB block');
});

test('RECORDS says how to get in while the service is locked', async () => {
  const { drawRecords } = await import('../src/windows/sessionTabs.js');
  const { g } = onTheJob();
  const texts = await drawn((ctx, sk, ui, input) => drawRecords(ctx, sk, BIG, g, g.session, ui, input, []));
  assert.ok(texts.includes('records service locked // crack records:8443 on the ACCESS tab'));
  assert.ok(!texts.some((t) => /^\d{3}-\d{2}-\d{4}$/.test(t)), 'no record shows yet');
});

test('RECORDS lists the people, with the job\'s person first and the ALTER button on their row only', async () => {
  const { drawRecords } = await import('../src/windows/sessionTabs.js');
  const { g, job, h } = onTheJob();
  openRecords(h);
  const p = g.world.people[job.record.person];
  const texts = await drawn((ctx, sk, ui, input) => drawRecords(ctx, sk, BIG, g, g.session, ui, input, []));
  assert.equal(texts.find((t) => / [A-Z]+$/.test(t) && g.world.people.some((x) => x.name === t)), p.name, 'the job\'s person is first');
  assert.ok(texts.includes(p.ssn));
  assert.ok(texts.includes('OBJECTIVE'));
  assert.equal(texts.filter((t) => t.startsWith('ALTER')).length, 1, 'one ALTER button');
  assert.ok(texts.includes(`ALTER → ${recordText(g, job.record.field, job.record.value)}`));
});

test('ACCESS tags the records service of a host with a job', async () => {
  const { drawAccess } = await import('../src/windows/sessionTabs.js');
  const { g } = onTheJob();
  const texts = await drawn((ctx, sk, ui, input) => drawAccess(ctx, sk, BIG, g, g.session, ui, input, []));
  assert.ok(texts.includes('OBJECTIVE'));
});

test('the listing shows the change under TARGET', async () => {
  const { buildPage } = await import('../src/windows/dsn/pages.js');
  const { g, job } = withAlteration();
  const page = buildPage(g, `job/${job.id}`);
  const change = page.controls.find((c) => c.kind === 'keyValue' && c.key === 'CHANGE');
  assert.ok(change && change.value.includes('→') && change.value.includes(recordText(g, job.record.field, job.record.value)));
});

// -- every person detail can be altered ----------------------------------------------------

const FIELDS = ['name', 'sex', 'ssn', 'criminalRecord', 'status', 'role', 'clearance', 'email', 'company', 'social'];

test('jobs are posted for every person detail, each a valid change on a host that keeps it', async () => {
  const { generateCustomContract } = await import('../src/state/contractSpawn.js');
  const g = makeGame('ALL', 7);
  const seen = new Set();
  for (let i = 0; i < 400 && seen.size < FIELDS.length; i += 1) {
    const c = generateCustomContract(g, { kind: 'modify' });
    if (!c) continue;
    const { person, field, value } = c.record;
    seen.add(field);
    const p = g.world.people[person];
    assert.ok(validRecord(g, field, value), `${field}: ${value}`);
    assert.notEqual(p[field], value, `${field}: the record does not read that yet`);
    assert.ok(keepsRecord(g, g.world.hosts[c.target], person, field), `${field}: kept on the target`);
  }
  assert.deepEqual([...seen].sort(), [...FIELDS].sort());
});

test('each detail is kept where it would be: civil on government, status on health, work on the employer, handles on media', () => {
  const g = makeGame('ALL', 7);
  const kinds = (h) => g.world.companies[h.company]?.kind;
  const gov = g.world.hosts.find((h) => h.kind === 'gov');
  const health = g.world.hosts.find((h) => kinds(h) === 'health');
  const media = g.world.hosts.find((h) => kinds(h) === 'media');
  for (const f of ['name', 'sex', 'ssn', 'criminalRecord']) assert.ok(recordsKept(g, gov).includes(f), f);
  assert.ok(recordsKept(g, health).includes('status'));
  assert.ok(recordsKept(g, media).includes('social'));
  // the work record only on the person's own employer
  const staff = g.world.people.findIndex((p) => p.company === health.company);
  const outsider = g.world.people.findIndex((p) => p.company !== health.company);
  assert.ok(keepsRecord(g, health, staff, 'role'));
  assert.ok(!keepsRecord(g, health, outsider, 'role'));
});

test('a value a detail cannot hold is refused', () => {
  const g = makeGame('ALL', 7);
  const bad = { name: 'x', sex: 'Q', ssn: '12-345', role: 'PIRATE KING', clearance: 9, email: 'nope', company: 999, social: 'no-at', status: 'ZOMBIE', criminalRecord: 'JAYWALKING' };
  for (const [f, v] of Object.entries(bad)) assert.ok(!validRecord(g, f, v), `${f}: ${v}`);
  const good = { name: 'ADA SMITH', sex: 'F', ssn: '123-45-6789', role: 'CFO', clearance: 5, email: 'ada.smith@drop7.nx', company: 1, social: '@ada77', status: 'DECEASED', criminalRecord: 'FRAUD' };
  for (const [f, v] of Object.entries(good)) assert.ok(validRecord(g, f, v), `${f}: ${v}`);
});

test('moving a person to another employer works through the task, and finishes the job', () => {
  const g = makeGame('MOVE', 7);
  const h = g.world.hosts.find((x) => x.company !== null && x.company !== undefined && g.world.people.some((p) => p.company === x.company));
  const person = g.world.people.findIndex((p) => p.company === h.company);
  const to = (h.company + 1) % g.world.companies.length;
  assert.equal(connect(g, h.id), null);
  g.session.phase = 'online';
  openRecords(h);
  const arg = { person, field: 'company', value: to };
  assert.equal(taskError(g, g.session, 'AlterRecord', arg), null);
  assert.equal(startTask(g, 'AlterRecord', arg), null);
  finish(g);
  assert.equal(g.world.people[person].company, to);
  assert.equal(recordText(g, 'company', to), g.world.companies[to].name);
});
