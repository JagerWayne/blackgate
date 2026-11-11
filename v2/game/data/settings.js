// The main game settings: how many profiles, people and companies a world has, and a few limits. They live in
// data/mainsettings.json; this file reads them with the built-in values as the fallback, so a missing file, a missing key or a
// silly number (text, negative, out of range) never breaks the game. Not to be confused with game.settings, the player's own
// toggles (sound, effects, autosave).
//
// Only a NEW world reads the world numbers: a saved world keeps the people and companies it was built with.

import { content } from './content.js';
import { languageCode, languages } from './language.js';

/// path -> [default, min, max, whole number?]
const SPEC = {
  'profiles.max': [4, 1, 12, true],
  'world.companies': [40, 6, 200, true],
  'world.population': [2000, 100, 20000, true],
  'world.relays': [10, 3, 40, true],
  'player.startingCash': [4000, 0, 10000000, true],
  'player.startingRating': [2, 0, 100, true],
  'routes.minHopLimit': [8, 1, 40, true],
  'routes.maxSaved': [6, 1, 40, true],
  'jobs.maxActive': [4, 1, 20, true],
  'notepad.maxPads': [12, 1, 100, true],
  'browser.maxTabs': [6, 1, 20, true],
  'bank.savingsRatePerDay': [0.004, 0, 1, false],
  'bank.savingsCap': [50000, 0, 1000000000, true],
  'bank.loanRatePerDay': [0.02, 0, 1, false],
  'bank.loanDays': [7, 1, 365, true],
};

/// The default of every setting, as the nested object of mainsettings.json.
export function defaultSettings() {
  const out = { language: 'en' };
  Object.entries(SPEC).forEach(([path, [def]]) => {
    const [a, b] = path.split('.');
    (out[a] ??= {})[b] = def;
  });
  return out;
}

/// One setting by its path ('world.population'): the file's value if it is a number in range, else the default.
export function setting(path) {
  const [def, min, max, whole] = SPEC[path];
  const [a, b] = path.split('.');
  const v = content()?.mainsettings?.[a]?.[b];
  if (typeof v !== 'number' || !Number.isFinite(v)) return def;
  const n = whole ? Math.round(v) : v;
  return n < min || n > max ? def : n;
}

/// Every setting with its default, range and whether it must be a whole number: what the editor in the Debug window lists.
export function settingList() {
  return Object.entries(SPEC).map(([path, [def, min, max, whole]]) => ({ path, def, min, max, whole }));
}

/// The value every setting has right now, as a flat path -> number map.
export function currentSettings() {
  return { language: languageCode(), ...Object.fromEntries(Object.keys(SPEC).map((p) => [p, setting(p)])) };
}

/// Checks a flat path -> value map (the editor's draft) and, when every value is fine, makes it the live settings.
/// Returns the problems found; an empty list means it was applied.
export function applySettings(draft) {
  const problems = [];
  const nested = {};
  const language = draft.language ?? languageCode();
  if (!(language in languages())) problems.push(`language must be one of ${Object.keys(languages()).join(', ')}`);
  else nested.language = language;
  settingList().forEach(({ path, min, max, whole }) => {
    const n = Number(draft[path]);
    if (draft[path] === '' || draft[path] == null || !Number.isFinite(n)) problems.push(`${path} must be a number`);
    else if (whole && !Number.isInteger(n)) problems.push(`${path} must be a whole number`);
    else if (n < min || n > max) problems.push(`${path} must be from ${min} to ${max}`);
    else {
      const [a, b] = path.split('.');
      (nested[a] ??= {})[b] = n;
    }
  });
  if (problems.length) return problems;
  const note = content().mainsettings?._note;
  content().mainsettings = note ? { _note: note, ...nested } : nested;
  return [];
}

/// The live settings as the text of mainsettings.json.
export function settingsText() {
  return `${JSON.stringify(content().mainsettings, null, 2)}\n`;
}

/// A mainsettings.json object (nested) as the editor's flat path -> value map.
export function flatSettings(obj) {
  const out = {};
  if (typeof obj?.language === 'string') out.language = obj.language;
  Object.entries(obj ?? {}).forEach(([a, v]) => {
    if (v && typeof v === 'object') Object.entries(v).forEach(([b, x]) => { out[`${a}.${b}`] = x; });
  });
  return out;
}

export const maxProfiles = () => setting('profiles.max');
export const companyCount = () => setting('world.companies');
export const population = () => setting('world.population');
export const relayCount = () => setting('world.relays');
export const startingCash = () => setting('player.startingCash');
export const startingRating = () => setting('player.startingRating');
export const minHopLimit = () => setting('routes.minHopLimit');
export const maxRoutes = () => setting('routes.maxSaved');
export const maxJobs = () => setting('jobs.maxActive');
export const maxPads = () => setting('notepad.maxPads');
export const maxTabs = () => setting('browser.maxTabs');
export const savingsRate = () => setting('bank.savingsRatePerDay');
export const savingsCap = () => setting('bank.savingsCap');
export const loanRate = () => setting('bank.loanRatePerDay');
export const loanDays = () => setting('bank.loanDays');
