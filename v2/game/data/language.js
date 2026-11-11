// The words of the game. Code asks for a string by key: t('header.logo'), or t('toast.sold', name, price) with {0} and {1}
// in the text. The strings live in data/language/<code>.json (en.json is the first); data/language/index.json lists the
// languages as { "en": "English" }; the choice is the `language` key of mainsettings.json.
//
// The file is read when this module loads (top-level await), so every module that imports it sees the words already, even
// ones that build a table of texts when they load. That also means a change of language needs a reload of the page.
// A key missing from the chosen language falls back to English, and a key missing from both shows as the key itself.

const FOLDER = new URL('../../data/', import.meta.url);

/// One JSON file of the data folder, or null if it cannot be read. The browser fetches it; the checks read it from disk.
async function readJson(name) {
  try {
    if (typeof process !== 'undefined' && process.versions?.node) {
      const { readFile } = await import('node:fs/promises');
      const { fileURLToPath } = await import('node:url');
      return JSON.parse(await readFile(fileURLToPath(new URL(name, FOLDER)), 'utf8'));
    }
    const res = await fetch(new URL(name, globalThis.location?.href ?? FOLDER));
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/// The language the player chose: the browser build keeps the Debug window's file in storage, the other reads mainsettings.json.
async function chosen() {
  try {
    const stored = globalThis.blackgate ? null : globalThis.localStorage?.getItem('blackgate.mainsettings');
    const code = stored ? JSON.parse(stored).language : null;
    if (typeof code === 'string') return code;
  } catch {}
  const file = await readJson('mainsettings.json');
  return typeof file?.language === 'string' ? file.language : 'en';
}

const available = (await readJson('language/index.json')) ?? { en: 'English' };
const wanted = await chosen();
const code = /^[a-z][a-z0-9-]{0,15}$/i.test(wanted) && wanted in available ? wanted : 'en';
const english = (await readJson('language/en.json')) ?? {};
const table = code === 'en' ? english : { ...english, ...((await readJson(`language/${code}.json`)) ?? {}) };

/// The languages that can be chosen: { code: name }.
export const languages = () => available;
/// The language in use.
export const languageCode = () => code;

/// The text of a key, with {0}, {1}... filled from the values after it.
export function t(key, ...vars) {
  const text = table[key] ?? key;
  return vars.length ? text.replace(/\{(\d+)\}/g, (m, i) => (Number(i) < vars.length ? String(vars[i]) : m)) : text;
}
