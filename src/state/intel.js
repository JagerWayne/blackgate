// OSINT: what the operator has found out about the people of the world, and
// what they have done to their phones and inboxes. A person starts unknown;
// a sweep makes them a lead; PROFILE fills in their details; the details
// open the phone and inbox attacks.

import { pushMail, toast, discover } from './gameState.js';

/// What each PROFILE level finds, in order.
export const INTEL_FIELDS = [
  { level: 1, field: 'email', label: 'EMAIL' },
  { level: 1, field: 'role', label: 'ROLE' },
  { level: 2, field: 'phone', label: 'PHONE' },
  { level: 3, field: 'social', label: 'SOCIAL' },
  { level: 4, field: 'leak', label: 'LEAKED PW' },
];

/// How long a phish takes to land, in game minutes, and how long spam buries
/// an admin.
export const PHISH_MINUTES = 180;
export const SPAM_MINUTES = 24 * 60;
/// How much slower a trace runs while the host's admin is buried in spam.
export const SPAM_TRACE = 0.7;

/// The intel on a person, made on first use.
export function intelOf(game, i) {
  game.intel ??= {};
  return (game.intel[i] ??= { level: 0 });
}

/// Whether the operator knows a field of a person.
export function knows(game, i, field) {
  if (game.intel?.[i]?.known?.[field]) return true;
  const need = INTEL_FIELDS.find((f) => f.field === field)?.level ?? 0;
  return (game.intel?.[i]?.level ?? 0) >= need && need > 0;
}

/// The details a person may show the world, and whether they do: worked out
/// from the seed, so a world keeps them without storing them. The role is
/// always public.
export const PUBLIC_FIELDS = ['email', 'phone', 'social'];
export function isPublic(game, i, field) {
  if (field === 'role') return true;
  let h = 2166136261;
  for (const ch of `${game.seed}:public:${field}:${i}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h % 100 < (field === 'social' ? 60 : field === 'email' ? 40 : 25);
}

/// Picks up one detail of a person (a click on a public email, phone or
/// handle): they go on file and the detail is known from then on, as if a
/// PROFILE had found it. Returns true when it was new.
export function learn(game, i, field) {
  const p = game.world.people[i];
  if (!p || knows(game, i, field)) return false;
  const intel = intelOf(game, i);
  (intel.known ??= {})[field] = true;
  const label = INTEL_FIELDS.find((f) => f.field === field)?.label ?? field.toUpperCase();
  toast(game, `${label} of ${p.name} added to the dossier`, 'good');
  return true;
}

/// A person's phone number. Worked out from their SSN, so it needs no draw
/// from the seed and old saves have one too.
export function phoneOf(person) {
  const d = person.ssn.replace(/\D/g, '');
  return `+1 (${d.slice(0, 3)}) 55${d.slice(3, 4)}-${d.slice(-4)}`;
}

/// A field of a person as the dossier shows it: the value, or ??? until found.
export function intelText(game, i, field) {
  if (!knows(game, i, field)) return '???';
  const p = game.world.people[i];
  return field === 'phone' ? phoneOf(p) : String(p[field]);
}

/// The people the operator has on file: leads and profiles, by index.
export function dossiers(game) {
  return Object.keys(game.intel ?? {}).map(Number).filter((i) => game.world.people[i]);
}

/// Every staffer of a company becomes a lead (a name on file, nothing more).
export function addLeads(game, company) {
  let n = 0;
  if (company === null || company === undefined) return 0;
  game.world.people.forEach((p, i) => {
    if (p.company !== company || game.intel?.[i]) return;
    intelOf(game, i);
    n += 1;
  });
  return n;
}

/// The locked service a person's access opens: the strongest lock on their
/// company's hosts that their clearance reaches. Voice locks need a voice.
export function serviceFor(game, i) {
  const p = game.world.people[i];
  const co = game.world.companies[p.company];
  let best = null;
  (co?.hosts ?? []).forEach((id) => {
    game.world.hosts[id].services.forEach((svc, k) => {
      if (svc.open || svc.kind === 'voice' || svc.password > p.clearance) return;
      if (!best || svc.password > best.svc.password) best = { host: id, index: k, svc };
    });
  });
  return best;
}

/// Opens the service a person's access reaches. Returns a line saying what
/// opened, or null when nothing was left to open.
export function useAccess(game, i) {
  const got = serviceFor(game, i);
  if (!got) return null;
  got.svc.open = true;
  const h = game.world.hosts[got.host];
  discover(game, got.host);
  return `${got.svc.name}:${got.svc.port} on ${h.name}`;
}

/// Whether a person is buried in spam right now.
export function spammed(game, i) {
  return (game.intel?.[i]?.spamUntil ?? -1) > game.clock.minutes;
}

/// A small fixed hash of a person and a moment: the same phish always lands
/// the same way, with no draw from the seed.
function roll(i, minute) {
  let h = 2166136261 ^ i;
  h = Math.imul(h ^ minute, 16777619) >>> 0;
  return (h % 1000) / 1000;
}

/// Whether a phish sent now will be taken: likelier the lower the clearance.
export function phishTaken(person, i, minute) {
  return roll(i, minute) < (6 - person.clearance) / 6;
}

/// Lands the phishes whose time has come. Called with the clock.
export function intelTick(game) {
  if (!game.intel) return;
  const now = game.clock.minutes;
  Object.entries(game.intel).forEach(([key, it]) => {
    if (it.phishAt === undefined || it.phishAt > now) return;
    const i = Number(key);
    const p = game.world.people[i];
    const taken = it.phishTaken;
    delete it.phishAt;
    delete it.phishTaken;
    if (!p) return;
    if (!taken) {
      pushMail(game, {
        id: 0, from: 'MAILER-DAEMON <bounce@spoof.kit>', subject: `PHISH IGNORED // ${p.name}`,
        body: `${p.name} did not take the bait. The reset link was never clicked.\n\nA lower clearance is easier to fool. You can try again.`,
        minute: now, read: false,
      });
      return;
    }
    it.inbox = true;
    const opened = useAccess(game, i);
    pushMail(game, {
      id: 0, from: 'SPOOF KIT <harvest@spoof.kit>', subject: `PHISH TAKEN // ${p.name}`,
      body: `${p.name} typed their password into the fake reset page.\n\nTheir inbox is yours: it shows as HACKED in DOSSIERS.\n${opened ? `Their password also opened ${opened}.` : 'Nothing locked was left that their clearance reaches.'}`,
      minute: now, read: false,
    });
    toast(game, `Phish taken // ${p.name}`, 'good');
  });
}
