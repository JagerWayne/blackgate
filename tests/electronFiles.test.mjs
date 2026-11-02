// The Electron shell's file helpers: the build id that decides a reinstall,
// the first-run copy that never overwrites, and the save names that can
// never leave saves/.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildId, readBuild, seed, saveFile } = require('../electron/files.js');

test('two builds of the same version get different ids', () => {
  const a = buildId('0.1.0', new Date('2026-11-01T10:00:00Z'));
  const b = buildId('0.1.0', new Date('2026-11-01T10:05:00Z'));
  assert.notEqual(a, b, 'a rebuild must reinstall');
  assert.ok(a.startsWith('0.1.0+'));
});

test('the build id is read from build.json, or is the version without one', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bg-'));
  assert.equal(readBuild(dir, '0.1.0'), '0.1.0', 'npm start has no build.json');
  fs.writeFileSync(path.join(dir, 'build.json'), JSON.stringify({ build: '0.1.0+x' }));
  assert.equal(readBuild(dir, '0.1.0'), '0.1.0+x');
});

test('the first-run copy adds missing files and never overwrites', () => {
  const src = fs.mkdtempSync(path.join(os.tmpdir(), 'bg-src-'));
  const dst = fs.mkdtempSync(path.join(os.tmpdir(), 'bg-dst-'));
  fs.mkdirSync(path.join(src, 'hints'));
  fs.writeFileSync(path.join(src, 'a.json'), '{"v":1}');
  fs.writeFileSync(path.join(src, 'hints', 'b.json'), '{"v":1}');
  fs.writeFileSync(path.join(src, 'pic.jpg'), 'x');
  fs.writeFileSync(path.join(dst, 'a.json'), '{"mine":true}');
  seed(src, dst);
  assert.equal(fs.readFileSync(path.join(dst, 'a.json'), 'utf8'), '{"mine":true}', 'the edit survives');
  assert.equal(fs.readFileSync(path.join(dst, 'hints', 'b.json'), 'utf8'), '{"v":1}', 'the missing file is added');
  assert.ok(!fs.existsSync(path.join(dst, 'pic.jpg')), 'only JSON is copied');
});

test('an update replaces a file the player never touched and keeps an edited one', () => {
  const src = fs.mkdtempSync(path.join(os.tmpdir(), 'bg-src-'));
  const dst = fs.mkdtempSync(path.join(os.tmpdir(), 'bg-dst-'));
  const put = (dir, name, text) => fs.writeFileSync(path.join(dir, name), text);
  const read = (name) => fs.readFileSync(path.join(dst, name), 'utf8');
  put(src, 'plain.json', '{"v":1}');
  put(src, 'edited.json', '{"v":1}');
  const first = seed(src, dst);
  assert.equal(read('plain.json'), '{"v":1}');
  put(dst, 'edited.json', '{"mine":true}');
  put(src, 'plain.json', '{"v":2}');
  put(src, 'edited.json', '{"v":2}');
  const next = seed(src, dst, first.hashes);
  assert.equal(read('plain.json'), '{"v":2}', 'the untouched file gets the new content');
  assert.equal(read('edited.json'), '{"mine":true}', 'the edit survives');
  assert.deepEqual(next.stale, ['edited.json']);
  assert.ok(!('edited.json' in next.hashes), 'an edited file is not recorded as shipped');
});

test('a save name is a plain name, never a path', () => {
  const dir = path.join('C:', 'x');
  assert.equal(saveFile(dir, 'WAAA'), path.join(dir, 'saves', 'WAAA.json'));
  for (const bad of ['../x', 'a/b', 'a\\b', '', '..']) {
    assert.throws(() => saveFile(dir, bad), /bad save key/, bad);
  }
});
