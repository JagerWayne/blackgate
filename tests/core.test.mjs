// The engine services and the world generation. Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, nextU32, nextF32, range, shuffle } from '../src/core/rng.js';
import { makeClock, hhmm, span, dateLine, weekday, advance } from '../src/core/clock.js';
import { mix, cssA, levelColor, rankName, setDark, isDark, theme } from '../src/core/theme.js';
import { measure, ellipsize, wrapLines, paragraph, lineHeight, fontSize } from '../src/core/text.js';
import { makeBoot, tickBoot } from '../src/render/boot.js';
import { placeControls, placeButtons } from '../src/ui/layout.js';
import { section, label, keyValue, buttons, ghost, CONTROL_H } from '../src/ui/controls.js';
import { initContent } from '../src/data/content.js';
import { generateWorld } from '../src/data/world.js';

await initContent();

test('the generator draws a fixed sequence for a seed', () => {
  const a = makeRng(42);
  const seq = Array.from({ length: 8 }, () => nextU32(a));
  assert.deepEqual(seq, [
    3053151217, 2432660849, 3723178883, 1792465177, 2853563819, 4047842737, 1538761951, 2339043496,
  ]);
  const b = makeRng(42);
  const floats = Array.from({ length: 6 }, () => nextF32(b));
  const want = [0.710867, 0.566398, 0.86687, 0.417341, 0.664397, 0.942462];
  floats.forEach((got, i) => assert.ok(Math.abs(got - want[i]) < 1e-6, `${got} != ${want[i]}`));
  const c = makeRng(7);
  assert.deepEqual(
    Array.from({ length: 8 }, () => range(c, 5, 10)),
    [7, 8, 5, 9, 9, 6, 6, 6],
  );
});

test('the generator keeps every value in range', () => {
  const r = makeRng(11);
  for (let i = 0; i < 5000; i += 1) {
    const v = range(r, 5, 10);
    assert.ok(v >= 5 && v < 10, `${v} is out of range`);
  }
});

test('a shuffle keeps every element', () => {
  const r = makeRng(3);
  const items = [0, 1, 2, 3, 4, 5, 6, 7];
  const out = shuffle(r, items.slice());
  assert.deepEqual(out.slice().sort((a, b) => a - b), items);
});

test('the clock reads the campaign calendar', () => {
  const clock = makeClock(0);
  assert.equal(hhmm(clock), '00:00');
  assert.equal(dateLine(clock), '12 MAR 2027');
  assert.equal(weekday(clock), 'FRI');
  assert.equal(span(38), '38M');
  assert.equal(span(7 * 60 + 12), '7H 12M');
  assert.equal(span(1440 + 4 * 60), '1D 04H 00M');
  assert.equal(span(2 * 1440 + 4 * 60), '2D 04H');
  advance(clock, 1440);
  assert.equal(dateLine(clock), '13 MAR 2027');
  assert.equal(weekday(clock), 'SAT');
});

test('the palette mixes and names', () => {
  assert.equal(mix(0x000000, 0xffffff, 0), 0x000000);
  assert.equal(mix(0x000000, 0xffffff, 1), 0xffffff);
  assert.equal(mix(0x000000, 0xffffff, 0.5), 0x808080);
  assert.equal(cssA(0x2069d8, 0.5), 'rgba(32,105,216,0.5)');
  assert.equal(levelColor(1), levelColor(2));
  assert.equal(rankName(0), 'SCRIPT KIDDIE');
  assert.equal(rankName(60), 'GHOST');
  setDark(true);
  assert.ok(isDark());
  assert.notEqual(theme().panel, 0);
  setDark(false);
});

test('text is measured, shortened and wrapped', () => {
  // a stand-in for the canvas: seven pixels a character
  const ctx = {
    font: '',
    fillStyle: '',
    textAlign: '',
    textBaseline: '',
    measureText: (s) => ({ width: s.length * 7 }),
    save() {},
    restore() {},
    fillText() {},
  };
  assert.equal(measure(ctx, 'abc', 10), 21);
  assert.equal(ellipsize(ctx, 'abcdefghij', 10, 100), 'abcdefghij');
  assert.equal(ellipsize(ctx, 'abcdefghij', 10, 35), 'abcd…');
  assert.deepEqual(wrapLines(ctx, 'one two three four', 10, 60), ['one two', 'three', 'four']);
  const used = paragraph(ctx, 'one two three four', { x: 0, y: 0, width: 60 }, 10, '#fff');
  assert.equal(used, 3 * lineHeight(10), 'the lines are as tall as the font is set');
  assert.ok(fontSize(9) >= 14, 'no text is set below 14');
  assert.ok(fontSize(15) > fontSize(9), 'the bigger sizes keep their lead');
});

test('the boot screen waits for the operator', () => {
  const idle = { pressed: false, enter: false };
  const boot = makeBoot();
  assert.equal(boot.done, false);
  for (let i = 0; i < 59; i += 1) tickBoot(boot, 0.1, idle);
  assert.equal(boot.done, false, 'the boot must not end early');
  for (let i = 0; i < 3; i += 1) tickBoot(boot, 0.1, idle);
  assert.equal(boot.done, true, 'the boot ends on its own after six seconds');
  const clicked = makeBoot();
  tickBoot(clicked, 0.1, { pressed: true, enter: false });
  assert.equal(clicked.done, true, 'a click ends the boot');
  const entered = makeBoot();
  tickBoot(entered, 0.1, { pressed: false, enter: true });
  assert.equal(entered.done, true, 'enter ends the boot');
});

test('the form layout measures the controls without overlap', () => {
  const ctx = {
    font: '',
    fillStyle: '',
    textAlign: '',
    textBaseline: '',
    measureText: (s) => ({ width: s.length * 7 }),
    save() {},
    restore() {},
    fillText() {},
  };
  const form = [
    section('TARGET'),
    label('A LABEL'),
    keyValue('KEY', 'VALUE'),
    buttons([{ id: 'a', text: 'ONE', style: ghost() }, { id: 'b', text: 'TWO', style: ghost() }]),
  ];
  const { placed, height } = placeControls(ctx, form, 200, 0, 1000);
  assert.equal(placed.length, 4);
  assert.ok(height > 0);
  for (let i = 1; i < placed.length; i += 1) {
    assert.ok(
      placed[i].y >= placed[i - 1].y + placed[i - 1].h - 0.01,
      `control ${i} overlaps the one before it`,
    );
  }
  assert.equal(placed[0].control.kind, 'section');
  assert.equal(placed[3].control.kind, 'buttons');
});

test('a row of buttons wraps when it runs out of room', () => {
  const ctx = { font: '', measureText: (s) => ({ width: s.length * 7 }) };
  const items = [
    { id: 'a', text: 'ALPHA', style: ghost() },
    { id: 'b', text: 'BRAVO', style: ghost() },
    { id: 'c', text: 'CHARLIE', style: ghost() },
  ];
  const narrow = placeButtons(ctx, 0, 0, 90, items);
  assert.equal(narrow.placed.length, 3);
  assert.ok(narrow.height > CONTROL_H, 'the buttons should have wrapped onto a second line');
  const wide = placeButtons(ctx, 0, 0, 400, items);
  assert.ok(wide.height <= CONTROL_H, 'the buttons should fit on one line');
});

test('a seed always builds the same world', () => {
  const w = generateWorld(7);
  assert.equal(w.hosts.length, 129);
  assert.equal(w.companies.length, 36);
  assert.equal(w.people.length, 158);
  assert.equal(w.accounts.length, 42);
  assert.equal(w.nic, 0);
  assert.equal(w.news, 1);
  assert.equal(w.blackgate, 2);
  assert.equal(w.homeCity, 50);
  assert.equal(w.companies[0].name, 'VANTA SYSTEMS');
  assert.equal(w.companies[0].short, 'van10');
  assert.equal(w.companies[0].city, 47);
  assert.equal(w.companies[0].wealth, 2);
  assert.equal(w.hosts[3].name, 'tehran relay');
  assert.equal(w.hosts[3].ip, '83.195.198.165');
  assert.equal(w.hosts[13].name, 'van10-mail');
  assert.equal(w.hosts[13].ip, '97.179.213.207');
  assert.equal(w.hosts[13].files.length, 5);
  assert.equal(w.hosts[13].files[0].name, 'vendor_list_96.pdf');
  assert.equal(w.hosts[13].files[0].size, 32);
  assert.equal(w.hosts[14].ip, '103.217.70.120');
  assert.equal(w.hosts[14].files.length, 7);
  assert.equal(w.people[0].name, 'PAVEL JOHNSON');
  assert.equal(w.people[0].email, 'pavel.johnson@van10.nx');
  assert.equal(w.accounts[0].number, 'NX00464844');
  assert.equal(w.accounts[0].bank, 'HALCYON CREDIT UNION');
});
