// The README says what the data says: every chassis, part and tool, with its price.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { initContent, software, chassis, boards, components } from '../game/data/content.js';

await initContent();

const readme = fs.readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
const money = (n) => n.toLocaleString('en-US');

test('every case and every board is in the README with its price and its room', () => {
  chassis().forEach((c) => {
    const row = readme.split(String.fromCharCode(10)).find((l) => l.startsWith(`| ${c.name} |`));
    assert.ok(row, `${c.name} has a row`);
    if (c.price) assert.ok(row.includes(money(c.price)), `${c.name}: ${row}`);
    assert.ok(row.includes(`| ${c.bays} |`), `${c.name} bays: ${row}`);
    assert.ok(row.includes(`| ${c.security_slots} |`), `${c.name} security slots: ${row}`);
  });
  boards().forEach((b) => {
    const row = readme.split(String.fromCharCode(10)).find((l) => l.startsWith(`| ${b.name} |`));
    assert.ok(row, `${b.name} has a row`);
    if (b.price) assert.ok(row.includes(money(b.price)), `${b.name}: ${row}`);
    assert.ok(row.includes(`| ${b.cpu_slots} (T${b.cpu_max}) |`), `${b.name} sockets: ${row}`);
    assert.ok(row.includes(`| ${b.storage_slots} (up to ${b.drive_cap >= 1024 ? `${b.drive_cap / 1024} TB` : `${b.drive_cap} GB`}) |`), `${b.name} drives: ${row}`);
  });
});

test('every part is in the README with its price', () => {
  components().filter((d) => d.tier < 90 && !d.onboard).forEach((d) => {
    assert.ok(readme.includes(`${d.name} (${money(d.price)} cr`), `${d.name} (${money(d.price)} cr)`);
  });
});

test('every tool is in the README, and every version of it is in the level table', () => {
  software().forEach((d) => {
    assert.ok(readme.includes(d.name), d.name);
    d.versions.forEach((v, i) => assert.ok(readme.includes(`V${i + 1} ${v} |`), `${d.kind} V${i + 1} ${v}`));
  });
});
