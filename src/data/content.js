// The content tables, read through one accessor layer, so a system never has
// to know which file a table came from.

import { loadContent } from './contentLoad.js';

let tables = null;

/// Loads the content folder and installs it.
export async function initContent(base = 'data/') {
  tables = await loadContent(base);
  return tables;
}

/// The raw tables.
export function content() {
  return tables;
}

/// The portrait files, by folder: { male: [...], female: [...] }.
export function portraits() { return tables.portraits; }

export function cities() { return tables.cities.cities; }

/// The country outlines: { code, name, rings: [[x, y, x, y, ...]] } in map fractions.
export function countries() { return tables.countries.countries; }
export function companyPrefix() { return tables.companies.prefix; }

/// The company name endings: "tech", "fin", "media" or "generic".
export function companySuffix(kind) { return tables.companies[`suffix_${kind}`] ?? []; }
export function firstNames() { return tables.people.first_names; }
export function lastNames() { return tables.people.last_names; }
export function roles() { return tables.people.roles; }
export function fileStems() { return tables.files.stems; }
export function fileExtensions() { return tables.files.extensions; }
export function newsHeadlines() { return tables.news.headlines; }
export function newsBodies() { return tables.news.bodies; }
export function rivals() { return tables.rivals.handles; }
export function clients() { return tables.clients.clients; }
export function darknet() { return tables.darknet; }

/// The brief pool for a mission kind: "retrieve", "delete", "modify"...
export function briefs(kind) { return tables.briefs[kind] ?? []; }

/// The tool shop.
export function software() { return tables.software.software; }

/// The rating needed per software level, 1..5.
export function unlocks() { return tables.unlocks.unlocks; }

/// The actions a link can carry out on the host, one per item.
export function sessionActions() {
  return Object.values(tables.sessionActions ?? {});
}

/// A line of copy from the hints folder, or '' when there is none.
export function hint(id) {
  return tables.hints?.[id]?.text ?? '';
}

/// The chassis catalogue.
export function chassis() { return tables.hardware.chassis; }

/// One chassis, by tier.
export function chassisDef(tier) {
  return chassis().find((d) => d.tier === tier) ?? chassis()[0];
}

/// The component catalogue.
export function components() { return tables.hardware.components; }

/// The components of one kind: "cpu", "ram", "storage", "modem" or "security".
export function componentsOf(kind) { return components().filter((d) => d.kind === kind); }

/// One component, by kind and tier.
export function componentDef(kind, tier) {
  return components().find((d) => d.kind === kind && d.tier === tier);
}

/// A custom mission template for a kind, picked by weight. `null` means the
/// built-in brief pool and reward apply.
export function missionFor(kind, rating, roll, pickIndex) {
  const pool = content().missions.missions
    .filter((m) => String(m.kind).toLowerCase() === kind.toLowerCase())
    .filter((m) => m.min_rating <= rating)
    .filter((m) => Array.isArray(m.brief) && m.brief.length > 0);
  if (pool.length === 0) return null;
  const total = pool.reduce((s, m) => s + Math.max(m.weight ?? 1, 0.01), 0);
  let at = roll * total;
  for (const m of pool) {
    at -= Math.max(m.weight ?? 1, 0.01);
    if (at <= 0) return m;
  }
  return pool[pickIndex % pool.length] ?? pool[pool.length - 1];
}
