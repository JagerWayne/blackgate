// The version: one number in the game and the package, and an update noticed once.
// Run with: node --test v2/tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION, justUpdated } from '../game/version.js';

test('the game and package.json carry the same version', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(VERSION, pkg.version);
});

test('an update is reported once, and a first install not at all', () => {
  const data = new Map();
  const store = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  assert.equal(justUpdated(store), null, 'a first install is not an update');
  assert.equal(justUpdated(store), null, 'the same version again');
  data.set('blackgate.seen-version', '0.0.9');
  assert.equal(justUpdated(store), '0.0.9', 'the old version, once');
  assert.equal(justUpdated(store), null);
});
