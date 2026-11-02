// The version: one number in the game and the package, shown on the login
// screen, and an update noticed once.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION, justUpdated } from '../src/version.js';
import { makeLogin, drawLogin } from '../src/render/login.js';
import { makeInput } from '../src/systems/input.js';
import { makeUiState } from '../src/ui/kit.js';
import { theme } from '../src/core/theme.js';
import { stubCtx } from './stubCanvas.mjs';

test('the game and package.json carry the same version', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(VERSION, pkg.version);
});

test('the login screen shows the version', () => {
  const ctx = stubCtx();
  drawLogin(ctx, makeLogin(), theme(), 1280, 800, makeInput(), makeUiState(), []);
  assert.ok(ctx.texts.some((t) => t.s === `BLACKGATE v${VERSION}`));
});

test('an update is reported once, and a first install not at all', () => {
  const data = new Map();
  const store = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  assert.equal(justUpdated(store), null, 'a first install is not an update');
  assert.equal(justUpdated(store), null, 'the same version again');
  data.set('blackgate.seen-version', '0.1.0');
  assert.equal(justUpdated(store), '0.1.0', 'the old version, once');
  assert.equal(justUpdated(store), null);
});
