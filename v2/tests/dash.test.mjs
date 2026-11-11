// The dashboard pieces draw what they are given and report clicks.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent } from '../game/data/content.js';
import { theme } from '../game/core/theme.js';
import { makeInput } from '../game/systems/input.js';
import { makeUiState } from '../pages/ui/kit.js';
import { statTile, chip, gauge, stepper, segmented, card } from '../pages/ui/dash.js';
import { stubCtx } from './stubCanvas.mjs';

await initContent();
const sk = theme();

test('a tile shows its caption, value and line, and a chip reports its width', () => {
  const ctx = stubCtx();
  statTile(ctx, sk, { x: 0, y: 0, w: 200, h: 80 }, 'SYS DRIVE', '40/256 GB', { frac: 0.15, sub: 'M.2 SSD' });
  const text = ctx.texts.map((t) => t.s);
  assert.deepEqual(text, ['SYS DRIVE', '40/256 GB', 'M.2 SSD']);
  assert.equal(chip(ctx, sk, 0, 0, 'ONLINE', 'ok'), 6 * 7 + 18);
});

test('a gauge clamps its fill', () => {
  const ctx = stubCtx();
  gauge(ctx, sk, { x: 0, y: 0, w: 100, h: 4 }, 3);
  gauge(ctx, sk, { x: 0, y: 0, w: 100, h: 4 }, NaN);
  assert.equal(ctx.fills.at(-3).w, 100);
});

test('the step bar numbers the steps and the segmented control lists its items', () => {
  const ctx = stubCtx();
  const ui = makeUiState();
  const input = makeInput();
  const events = [];
  stepper(ctx, sk, ui, input, events, { x: 0, y: 0, w: 500, h: 46 }, [
    { label: 'CASE', state: 'done' }, { label: 'BOARD', state: 'current' }, { label: 'PARTS', state: 'todo' },
  ]);
  assert.deepEqual(ctx.texts.map((t) => t.s), ['OK', 'CASE', '2', 'BOARD', '3', 'PARTS']);
  segmented(ctx, sk, ui, input, events, { x: 0, y: 0, w: 300, h: 28 }, [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], 0);
  assert.ok(ctx.texts.some((t) => t.s === 'A') && ctx.texts.some((t) => t.s === 'B'));
  const body = card(ctx, sk, { x: 0, y: 0, w: 200, h: 100 }, 'CAPTION', 'right');
  assert.ok(body.w < 200 && body.y > 28);
});
