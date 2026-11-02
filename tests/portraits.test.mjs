// Portraits and the RECORDS search: a face for every person, from the image
// folders, and a list that can be searched.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { initContent, portraits } from '../src/data/content.js';
import { makeGame } from '../src/state/gameState.js';
import { portraitOf, PLACEHOLDER, loadedImage } from '../src/ui/portrait.js';
import { connect } from '../src/systems/sessionTick.js';
import { drawRecords } from '../src/windows/sessionTabs.js';
import { handleEvents } from '../src/systems/events.js';
import { stubCtx } from './stubCanvas.mjs';
import { makeUiState } from '../src/ui/kit.js';
import { makeInput } from '../src/systems/input.js';
import { theme } from '../src/core/theme.js';

await initContent();

const jpgs = (dir) => readdirSync(new URL(`../data/images/people/${dir}/`, import.meta.url)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();

test('the image list matches the folders (run `node tools/portraits.mjs` after adding images)', () => {
  assert.deepEqual([...portraits().male].sort(), jpgs('male'));
  assert.deepEqual([...portraits().female].sort(), jpgs('female'));
});

test('a person gets a face from their own folder, the same one every time', () => {
  const g = makeGame('FACE', 7);
  g.world.people.forEach((p, i) => {
    const src = portraitOf(g, i);
    assert.ok(src.startsWith(`./data/images/people/${p.sex === 'F' ? 'female' : 'male'}/`), p.name);
    assert.equal(portraitOf(g, i), src, 'stable');
  });
  const faces = new Set(g.world.people.map((p, i) => portraitOf(g, i)));
  assert.ok(faces.size > 10, 'people do not all share one face');
});

test('renaming someone keeps their face; changing their sex changes folder', () => {
  const g = makeGame('FACE', 7);
  const i = g.world.people.findIndex((p) => p.sex === 'M');
  const face = portraitOf(g, i);
  g.world.people[i].name = 'SOMEONE ELSE';
  assert.equal(portraitOf(g, i), face);
  g.world.people[i].sex = 'F';
  assert.match(portraitOf(g, i), /\/female\//);
});

test('with an empty folder the placeholder is used', () => {
  const g = makeGame('FACE', 7);
  const list = portraits().female;
  const saved = list.splice(0);
  try {
    const i = g.world.people.findIndex((p) => p.sex === 'F');
    assert.equal(portraitOf(g, i), PLACEHOLDER.F);
    assert.equal(PLACEHOLDER.F, './data/images/people/ph-female.jpg');
    assert.equal(PLACEHOLDER.M, './data/images/people/ph-male.jpg');
  } finally {
    list.push(...saved);
  }
});

// -- the RECORDS tab ----------------------------------------------------------------

/// A link to a government host with its records open.
function openGov() {
  const g = makeGame('FACE', 7);
  const h = g.world.hosts.find((x) => x.kind === 'gov' && x.company !== null && x.company !== undefined);
  assert.equal(connect(g, h.id), null);
  g.session.phase = 'online';
  h.services.filter((v) => v.kind === 'records').forEach((v) => { v.open = true; });
  return { g, h };
}
function draw(g, view) {
  const ctx = stubCtx();
  drawRecords(ctx, theme(), { x: 0, y: 0, w: 1100, h: 4000 }, g, g.session, makeUiState(), makeInput(), [], view);
  return ctx.texts.map((t) => t.s);
}
const isName = (g) => (t) => g.world.people.some((p) => p.name === t);

test('the search narrows the list to people whose name, SSN, role or employer match', () => {
  const { g } = openGov();
  const target = g.world.people[5];
  const surname = target.name.split(' ')[1];
  const all = draw(g, {}).filter(isName(g));
  const found = draw(g, { recQuery: target.name.toLowerCase() }).filter(isName(g));
  assert.ok(found.length <= all.length, 'no more people than before');
  assert.ok(found.length >= 1);
  assert.ok(found.every((n) => n.includes(surname)), 'only matches');
  const bySsn = draw(g, { recQuery: target.ssn }).filter(isName(g));
  assert.ok(bySsn.includes(target.name));
  assert.ok(draw(g, { recQuery: 'zzzz' }).some((t) => /nothing matches/.test(t)));
});

test('picking a row shows that person in full in the detail pane', () => {
  const { g } = openGov();
  const view = {};
  draw(g, view);
  const state = { game: g, win: { blackgate: view }, windows: { list: [] }, ui: {}, input: {} };
  handleEvents(state, [{ type: 'select', id: 'sess.records', index: 3 }], { x: 0, y: 0, w: 800, h: 600 });
  const person = view.recOrder[3];
  assert.equal(view.recSel, person);
  const p = g.world.people[person];
  const texts = draw(g, view);
  for (const v of [p.email, p.social, String(p.clearance), p.status]) assert.ok(texts.includes(v), v);
});

test('a portrait that failed to load is tried again later, not for ever', () => {
  const made = [];
  globalThis.Image = class {
    set src(v) {
      made.push(v);
      this.onerror?.();
    }
  };
  const realNow = Date.now;
  let t = 1000;
  Date.now = () => t;
  try {
    assert.equal(loadedImage('missing.jpg'), null);
    assert.equal(loadedImage('missing.jpg'), null);
    assert.equal(made.length, 1, 'not asked for again at once');
    t += 60000;
    loadedImage('missing.jpg');
    assert.equal(made.length, 2, 'asked for again after a while');
  } finally {
    Date.now = realNow;
    delete globalThis.Image;
  }
});
