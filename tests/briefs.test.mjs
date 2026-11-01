// Briefs: the values filled into a brief are highlighted where it is shown.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { fillBrief } from '../src/state/contractPost.js';
import { paragraph } from '../src/core/text.js';
import { stubCtx } from './stubCanvas.mjs';

test('a filled brief keeps braces around each value', () => {
  assert.equal(
    fillBrief('Pull {file} from {host} at {co}.', 'plans.pdf', 'van10-mail', 'VANTA SYSTEMS', 0),
    'Pull {plans.pdf} from {van10-mail} at {VANTA SYSTEMS}.',
  );
});

test('a highlighted paragraph draws the braced parts in the highlight colour, without the braces', () => {
  const ctx = stubCtx();
  paragraph(ctx, 'Pull {plans.pdf} from {VANTA SYSTEMS} today.', { x: 0, y: 0, width: 2000 }, 14, '#111', { hl: '#f80' });
  const drawn = ctx.texts.map((t) => t.s).join('');
  assert.ok(!drawn.includes('{') && !drawn.includes('}'), 'no braces are drawn');
  assert.equal(drawn, 'Pull plans.pdf from VANTA SYSTEMS today.');
  const lit = ctx.texts.filter((t) => t.style === '#f80').map((t) => t.s);
  assert.deepEqual(lit, ['plans.pdf', 'VANTA SYSTEMS']);
});

test('a highlight that wraps across lines stays lit on the next line', () => {
  const ctx = stubCtx();
  paragraph(ctx, 'go {ONE TWO THREE} now', { x: 0, y: 0, width: 60 }, 14, '#111', { hl: '#f80' });
  const lit = ctx.texts.filter((t) => t.style === '#f80').map((t) => t.s.trim()).join(' ');
  assert.equal(lit, 'ONE TWO THREE');
});

test('without a highlight colour the text is drawn as it is', () => {
  const ctx = stubCtx();
  paragraph(ctx, 'a {b} c', { x: 0, y: 0, width: 2000 }, 14, '#111');
  assert.deepEqual(ctx.texts.map((t) => t.s), ['a {b} c']);
});
