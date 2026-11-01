// Rebuilds data/images/people/index.json from the image folders. A browser
// cannot list a folder, so the game reads this list instead.
// Run after adding or removing portraits: node tools/portraits.mjs
import { readdirSync, writeFileSync } from 'node:fs';

const root = new URL('../data/images/people/', import.meta.url);
const list = (dir) => readdirSync(new URL(`${dir}/`, root)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
const index = { male: list('male'), female: list('female') };
writeFileSync(new URL('index.json', root), `${JSON.stringify(index, null, 2)}\n`);
console.log(`portraits: ${index.male.length} male, ${index.female.length} female`);
