// The scrolled forms the windows show: they start at the top of their box
// and their paragraphs wrap at the box's width. Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { drawScrolled } from '../pages/ui/scroll.js';
import { label, para, keyValue, chips } from '../pages/ui/controls.js';
import { makeUiState } from '../pages/ui/kit.js';
import { makeInput } from '../game/systems/input.js';
import { theme, color } from '../game/core/theme.js';
import { stubCtx } from './stubCanvas.mjs';

const BRIEF = 'there is a file called keyring_backup behind the portal retrieve it';

function drawForm(box) {
  const ctx = stubCtx();
  const controls = [label('TITLE', 15), para(BRIEF, 11.5), keyValue('TARGET HOST', '10.0.0.1')];
  drawScrolled(ctx, theme(), box, controls, 'f', makeUiState(), makeInput(), []);
  return ctx.texts;
}

test('a scrolled form starts at the top of its box', () => {
  const box = { x: 480, y: 120, w: 420, h: 400 };
  const texts = drawForm(box);
  const title = texts.find((t) => t.s === 'TITLE');
  assert.ok(title, 'the title is drawn');
  assert.ok(title.y >= box.y && title.y < box.y + 30, `title at y=${title.y}, box top ${box.y}`);
  texts.forEach((t) => assert.ok(t.y >= box.y && t.y < box.y + box.h, `${t.s} at y=${t.y}`));
});

test('a chip shows its word in its own colour on a pale ground', () => {
  const ctx = stubCtx();
  const sk = theme();
  drawScrolled(ctx, sk, { x: 0, y: 0, w: 400, h: 200 }, [chips([['OFFERED', sk.muted]])], 'c', makeUiState(), makeInput(), []);
  const word = ctx.texts.find((t) => t.s === 'OFFERED');
  assert.ok(word, 'the chip word is drawn');
  assert.equal(word.style, color(sk.muted), 'in the colour the chip asked for');
  const ground = ctx.fills.find((f) => f.w > 20 && f.h === 24);
  assert.ok(ground && ground.style.startsWith('rgba('), `the ground is see-through, got ${ground?.style}`);
});

test('a paragraph wraps at the width of its box, not word by word', () => {
  const texts = drawForm({ x: 20, y: 20, w: 900, h: 400 });
  const words = BRIEF.split(' ');
  const lines = texts.filter((t) => words.some((w) => t.s.split(' ').includes(w)));
  assert.equal(lines.length, 1, `the brief fits one line at 900 px, got ${lines.length}`);
  assert.equal(lines[0].s, BRIEF);
});
