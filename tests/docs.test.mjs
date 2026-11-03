// The README says what the data says: every chassis, part and tool, with its price.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { initContent, software, chassis, components } from '../src/data/content.js';

await initContent();

const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const money = (n) => n.toLocaleString('en-US');

test('every chassis is in the README with its price and its slots', () => {
  chassis().forEach((c) => {
    const row = readme.split('\n').find((l) => l.startsWith(`| ${c.name} |`));
    assert.ok(row, `${c.name} has a row`);
    if (c.price) assert.ok(row.includes(money(c.price)), `${c.name}: ${row}`);
    assert.ok(row.includes(`| ${c.cpu_slots} |`), `${c.name} sockets: ${row}`);
    assert.ok(row.includes(`| ${c.security_slots} |`), `${c.name} defense slots: ${row}`);
  });
});

test('every part is in the README with its price', () => {
  components().filter((d) => d.tier < 90).forEach((d) => {
    assert.ok(readme.includes(`${d.name} (${money(d.price)} cr`), `${d.name} (${money(d.price)} cr)`);
  });
});

test('every tool is in the README, and every version of it is in the level table', () => {
  software().forEach((d) => {
    assert.ok(readme.includes(d.name), d.name);
    d.versions.forEach((v, i) => assert.ok(readme.includes(`V${i + 1} ${v} |`), `${d.kind} V${i + 1} ${v}`));
  });
});
