// Rebuilds the SleekPages lists in data/images/socialmedia: images.json (the
// photos in each topic folder) and text.json (the numbered lines of text.txt
// under each "### Topic" heading). A browser cannot list a folder, so the game
// reads these. Run after adding photos or lines: node tools/socialmedia.mjs
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';

const root = new URL('../data/images/socialmedia/', import.meta.url);

/// The numbered lines under each "### Topic" heading, by lower-case topic.
export function parseText(src) {
  const out = {};
  let topic = null;
  for (const raw of src.split(/\r?\n/)) {
    const line = raw.trim();
    const head = line.match(/^#+\s*(.+)$/);
    if (head) {
      topic = head[1].trim().toLowerCase();
      out[topic] ??= [];
    } else if (topic && line) {
      const text = line.replace(/^\d+[.)]\s*/, '').trim();
      if (text) out[topic].push(text);
    }
  }
  return out;
}

// run as a script (not when a test imports parseText)
if (process.argv[1]?.endsWith('socialmedia.mjs')) {
  const images = {};
  for (const dir of readdirSync(root).sort()) {
    if (!statSync(new URL(dir, root)).isDirectory()) continue;
    images[dir] = readdirSync(new URL(`${dir}/`, root)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
  }
  const text = parseText(readFileSync(new URL('text.txt', root), 'utf8'));
  writeFileSync(new URL('images.json', root), `${JSON.stringify(images, null, 2)}\n`);
  writeFileSync(new URL('text.json', root), `${JSON.stringify(text, null, 2)}\n`);
  console.log(`socialmedia: ${Object.entries(images).map(([k, v]) => `${k} ${v.length} photos / ${text[k]?.length ?? 0} lines`).join(', ')}`);
}
