// Person records: which host keeps which detail, what a detail may read, and
// the changes ALTERATION jobs ask for.

import { range, pick } from '../core/rng.js';
import { firstNames, lastNames, roles } from '../data/content.js';
import { OFFENCES } from '../data/worldCompanies.js';

/// What each detail is called on screen.
export const RECORD_LABEL = {
  name: 'NAME', sex: 'SEX', ssn: 'SSN', criminalRecord: 'CRIMINAL RECORD', status: 'VITAL STATUS',
  role: 'ROLE', clearance: 'CLEARANCE', email: 'WORK EMAIL', company: 'EMPLOYER', social: 'SOCIAL HANDLE',
};

/// The work record: kept only on the person's own employer's hosts.
export const WORK_FIELDS = ['role', 'clearance', 'email', 'company'];

/// The details a host keeps: civil identity and convictions on government
/// hosts, vital status on a health company's, handles on a media company's,
/// and the work record of its own staff on any company's.
export function recordsKept(game, h) {
  if (h.company === null || h.company === undefined) return [];
  const kind = game.world.companies[h.company]?.kind;
  const own = h.kind === 'gov' ? ['name', 'sex', 'ssn', 'criminalRecord']
    : kind === 'health' ? ['status']
      : kind === 'media' ? ['social'] : [];
  return [...own, ...WORK_FIELDS];
}

/// Whether a host keeps one detail of one person.
export function keepsRecord(game, h, person, field) {
  if (!recordsKept(game, h).includes(field)) return false;
  return !WORK_FIELDS.includes(field) || game.world.people[person]?.company === h.company;
}

/// Whether a detail can read a value.
export function validRecord(game, field, value) {
  switch (field) {
    case 'name': return /^[A-Z][A-Z'-]* [A-Z][A-Z' -]*$/.test(value);
    case 'sex': return value === 'M' || value === 'F';
    case 'ssn': return /^\d{3}-\d{2}-\d{4}$/.test(value);
    case 'criminalRecord': return value === 'CLEAN' || OFFENCES.includes(value);
    case 'status': return value === 'ACTIVE' || value === 'DECEASED';
    case 'role': return roles().includes(value);
    case 'clearance': return Number.isInteger(value) && value >= 1 && value <= 5;
    case 'email': return /^[a-z0-9._-]+@[a-z0-9.-]+$/.test(value);
    case 'company': return Number.isInteger(value) && !!game.world.companies[value];
    case 'social': return /^@[a-z0-9_]+$/.test(value);
    default: return false;
  }
}

/// A value typed in, in the form the record holds: words in capitals, a
/// clearance as a number, an employer by its name (or its number).
export function parseRecord(game, field, text) {
  const s = String(text ?? '').trim();
  if (field === 'clearance') return Number(s);
  if (field === 'company') {
    const at = game.world.companies.findIndex((c) => c.name === s.toUpperCase());
    return at >= 0 ? at : Number(s);
  }
  return ['email', 'social'].includes(field) ? s.toLowerCase() : s.toUpperCase();
}

/// A value as the player reads it: an employer by its name.
export function recordText(game, field, value) {
  return field === 'company' ? game.world.companies[value]?.name ?? '?' : String(value);
}

/// A change a client would pay for on a host: a new identity, a death or a
/// resurrection, a record cleared or planted, a promotion, a transfer, a
/// hijacked inbox or handle. Null when this host has no one to change.
export function pickChange(game, h) {
  const rng = game.rng;
  const field = pick(rng, recordsKept(game, h));
  const pool = game.world.people.map((p, i) => i).filter((i) => keepsRecord(game, h, i, field));
  if (!pool.length) return null;
  const person = pool[range(rng, 0, pool.length)];
  const p = game.world.people[person];
  const tag = range(rng, 10, 99);
  const value = {
    name: () => `${pick(rng, firstNames()).name} ${pick(rng, lastNames())}`,
    sex: () => (p.sex === 'M' ? 'F' : 'M'),
    ssn: () => `${range(rng, 100, 900)}-${range(rng, 10, 100)}-${range(rng, 1000, 10000)}`,
    criminalRecord: () => (p.criminalRecord === 'CLEAN' ? pick(rng, OFFENCES) : 'CLEAN'),
    status: () => (p.status === 'ACTIVE' ? 'DECEASED' : 'ACTIVE'),
    role: () => pick(rng, roles()),
    clearance: () => (p.clearance < 5 ? 5 : 1),
    email: () => `${p.email.split('@')[0]}@drop${tag}.nx`,
    company: () => range(rng, 0, game.world.companies.length),
    social: () => `@ghost_${p.social.slice(1)}${tag}`,
  }[field]();
  return value === p[field] ? null : { person, field, value };
}
