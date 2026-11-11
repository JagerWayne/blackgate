// Moves the player-facing strings of the code into data/language/en.json and leaves a call of the language module in their
// place, so the English text is exactly what it was. Run from the repo root:  node v2/tools/i18n-extract.mjs
//
// It only touches strings it can tell are words for the player, by where they stand:
//   toast(game, TEXT)  fail(TEXT)  and the properties help / about / placeholder / tip / hint / sub,
//   `text:` of a button ({ id, text }), `label:` of a figure ({ label, value }), the window titles in game/state/windows.js,
//   and every sentence of the Info manual (app/apps/infoText.js).
// A template string becomes TEXT with {0}, {1} for its ${...} parts; the parts stay in the code as arguments.
// It can be run again: strings already moved are calls, not text, and the keys already in en.json are kept.

import fs from 'node:fs';
import path from 'node:path';
import { parseAst } from 'rolldown/parseAst';
import MagicString from 'magic-string';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIRS = ['app', 'pages', 'game'];
const SKIP = new Set(['game/data/language.js', 'game/data/settings.js']);
const OUT = path.join(ROOT, 'data', 'language', 'en.json');

const table = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const stats = {};

function* files(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* files(p);
    else if (e.name.endsWith('.js')) yield p;
  }
}

/// The text of a string or template node and the source of its ${...} parts, or null for anything else.
function textOf(node, code) {
  if (node.type === 'Literal' && typeof node.value === 'string') return { text: node.value, vars: [] };
  if (node.type === 'TemplateLiteral') {
    if (node.quasis.some((q) => q.value.cooked == null)) return null;
    let text = '';
    node.quasis.forEach((q, i) => {
      text += q.value.cooked;
      if (i < node.expressions.length) text += `{${i}}`;
    });
    return { text, vars: node.expressions.map((e) => code.slice(e.start, e.end)) };
  }
  return null;
}

const words = (text) => (text.replace(/\{\d+\}/g, ' ').match(/[A-Za-z]{2,}/g) ?? []).length;

/// Whether the node stands where a string is words for the player.
function isText(node, parent, grand, rel, text) {
  if (!parent) return false;
  if (rel === 'app/apps/infoText.js') return words(text) >= 2 && !text.includes('class=') && !(parent.type === 'Property' && parent.key === node);
  if (words(text) < 1) return false;
  if (parent.type === 'CallExpression' && parent.callee.type === 'Identifier') {
    const i = parent.arguments.indexOf(node);
    return (parent.callee.name === 'toast' && i === 1) || (parent.callee.name === 'fail' && i === 0);
  }
  if (parent.type === 'Property' && !parent.computed && parent.value === node && parent.key.type === 'Identifier' && grand?.type === 'ObjectExpression') {
    const k = parent.key.name;
    const has = (name) => grand.properties.some((p) => p.key?.name === name);
    if (['help', 'about', 'placeholder', 'tip', 'hint', 'sub'].includes(k)) return true;
    if (k === 'title' && rel === 'game/state/windows.js') return true;
    if (k === 'text' && has('id')) return true;
    if (k === 'label' && has('value')) return true;
  }
  return false;
}

for (const dir of DIRS) {
  for (const file of files(path.join(ROOT, dir))) {
    const rel = path.relative(ROOT, file).replaceAll('\\', '/');
    if (SKIP.has(rel)) continue;
    const code = fs.readFileSync(file, 'utf8');
    let ast;
    try { ast = parseAst(code, { lang: 'js' }); } catch { continue; }
    const ms = new MagicString(code);
    const prefix = rel.replace(/^(app|game|pages)\//, '').replace(/\.js$/, '').replaceAll('/', '.');
    const keysHere = new Map(); // text -> key, so the same words in one file share a key
    let n = 0;

    const keyFor = (text) => {
      if (keysHere.has(text)) return keysHere.get(text);
      const slug = (text.replace(/\{\d+\}/g, ' ').toLowerCase().match(/[a-z0-9]+/g) ?? ['text']).slice(0, 4).join('_');
      let key = `${prefix}.${slug}`;
      for (let i = 2; key in table && table[key] !== text; i += 1) key = `${prefix}.${slug}_${i}`;
      table[key] = text;
      keysHere.set(text, key);
      return key;
    };

    const walk = (node, parent, grand) => {
      if (!node || typeof node.type !== 'string') return;
      const got = textOf(node, code);
      if (got && isText(node, parent, grand, rel, got.text)) {
        const key = keyFor(got.text);
        ms.overwrite(node.start, node.end, got.vars.length ? `tl('${key}', ${got.vars.join(', ')})` : `tl('${key}')`);
        n += 1;
        return;
      }
      for (const k of Object.keys(node)) {
        const v = node[k];
        if (Array.isArray(v)) v.forEach((c) => walk(c, node, parent));
        else if (v && typeof v === 'object') walk(v, node, parent);
      }
    };
    walk(ast, null, null);

    if (n) {
      const imports = ast.body.filter((s) => s.type === 'ImportDeclaration');
      const from = path.relative(path.dirname(file), path.join(ROOT, 'game', 'data', 'language.js')).replaceAll('\\', '/');
      const line = `import { t as tl } from '${from.startsWith('.') ? from : `./${from}`}';`;
      if (imports.length) ms.appendLeft(imports.at(-1).end, `\n${line}`);
      else ms.prepend(`${line}\n`);
      fs.writeFileSync(file, ms.toString());
      stats[rel] = n;
    }
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(table, null, 2)}\n`);
const idx = path.join(path.dirname(OUT), 'index.json');
if (!fs.existsSync(idx)) fs.writeFileSync(idx, `${JSON.stringify({ en: 'English' }, null, 2)}\n`);
console.log(`${Object.values(stats).reduce((a, b) => a + b, 0)} strings in ${Object.keys(stats).length} files, ${Object.keys(table).length} keys`);
