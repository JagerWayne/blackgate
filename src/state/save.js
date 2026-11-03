import { padsOf } from './notes.js';
// The save file: the whole run, kept in the browser's local store, or in a
// file under Documents/Games/Blackgate/saves when the Electron app provides one.

import { rngFromJson } from '../core/rng.js';
import { SAVE_VERSION } from './gameState.js';
import { cheatsOf } from './cheats.js';
import { componentsOf, firstNames, software } from '../data/content.js';
import { personRecord } from '../data/worldCompanies.js';
import { rankName } from '../core/theme.js';
import { toolPrice } from './economy.js';
import { assignAuth } from '../data/auth.js';
import { markInternal } from '../data/network.js';
import { hostReport } from './hostReport.js';

// One save per operator, under PREFIX + their file-safe name. LEGACY is the
// old single save; it is moved to its operator's key the first time it is seen.
const PREFIX = 'blackgate.save.';
const LEGACY = 'blackgate.save';
// Electron's preload gives a file-backed store with the same calls.
const store = () => globalThis.blackgate?.store ?? localStorage;
// The operator whose run was saved or loaded last: loadRun's default.
let current = null;

/// A handle as a name safe for a key and a file name.
export function safeName(handle) {
  return String(handle).trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_').slice(0, 40) || 'OPERATOR';
}

const keyOf = (handle) => PREFIX + safeName(handle);

/// Every key in the store. localStorage lists its keys with Object.keys.
function allKeys() {
  const s = store();
  return s.keys ? s.keys() : Object.keys(s);
}

/// Moves the old single save to its operator's key. A damaged one stays put.
function migrate() {
  try {
    const text = store().getItem(LEGACY);
    if (!text) return;
    const handle = JSON.parse(text)?.player?.handle;
    if (typeof handle !== 'string') return;
    if (!store().getItem(keyOf(handle))) store().setItem(keyOf(handle), text);
    store().removeItem(LEGACY);
  } catch (e) { console.warn('save: old save not moved', e); }
}

/// The keys of every saved operator.
function saveKeys() {
  migrate();
  try {
    return allKeys().filter((k) => k.startsWith(PREFIX) && !k.endsWith('.bak'));
  } catch {
    return [];
  }
}

/// Writes the run. The generator state is kept as strings, because a BigInt
/// cannot go through JSON.
export function saveRun(game) {
  try {
    const text = JSON.stringify(game, (k, v) => (typeof v === 'bigint' ? v.toString() : v));
    const key = keyOf(game.player.handle);
    // a save this build cannot read is kept as .bak before a new run takes its place
    const old = store().getItem(key);
    if (old && !readable(old)) store().setItem(`${key}.bak`, old);
    store().setItem(key, text);
    // the desktop app keeps a readable report of the visited hosts beside it
    try {
      globalThis.blackgate?.writeReport?.(safeName(game.player.handle), JSON.stringify(hostReport(game), null, 2));
    } catch (e) { console.warn('save: host report not written', e); } // the report is a convenience: a failure never fails the save
    current = game.player.handle;
    return true;
  } catch (e) {
    console.error('save: could not write the run', e);
    return false;
  }
}

function readable(text) {
  try {
    return isSound(JSON.parse(text));
  } catch {
    return false;
  }
}

/// Reads an operator's run (by default the last one saved or loaded), or null
/// when there is none.
export function loadRun(handle = current) {
  if (handle == null) return null;
  migrate();
  let text = null;
  try {
    text = store().getItem(keyOf(handle));
  } catch (e) {
    console.error('save: could not read the store', e);
    return null;
  }
  if (!text) return null;
  try {
    const g = JSON.parse(text);
    if (g?.version === 1) refundOldHardware(g);
    if (!isSound(g)) return null;
    g.rng = rngFromJson(g.rng);
    g.session = null;
    current = g.player.handle;
    g.gameOver = null;
    g.paused = false;
    g.toasts = [];
    cheatsOf(g);
    padsOf(g);
    fillRecords(g);
    revealLiveTargets(g);
    repairLiveJobs(g);
    clampLocks(g);
    cutLostLevels(g);
    return g;
  } catch (e) {
    console.error('save: could not load the run', e);
    return null;
  }
}

/// The prices of the catalogue before the Modern Uplink hardware (save version
/// 1), kept only to pay an old run back.
const OLD_PRICES = {
  cpu: [3200, 9800, 26000, 61000, 140000],
  ram: [900, 3200, 8600, 19000, 48000],
  memory: [900, 3200, 8600, 19000, 48000],
  storage: [600, 2800, 7500, 18000, 45000],
  modem: [1200, 6400, 18000, 52000, 150000],
  security: [1800, 7200, 21000, 58000, 130000],
};
const OLD_CHASSIS_PRICES = [0, 15000, 48000, 120000, 300000];

/// A run saved on the old catalogue (version 1): every fitted part, every
/// stocked part and the chassis are paid back at the old prices, and the
/// gateway goes back to the starter Pelican. The world, jobs, mail, dossiers
/// and tools are kept.
function refundOldHardware(g) {
  const gwy = g.player.gateway ?? {};
  const parts = (gwy.parts ?? []).reduce((n, p) => n + (OLD_PRICES[p.kind]?.[p.level - 1] ?? 0), 0);
  const stock = (g.player.stock ?? []).reduce((n, s) => n + (s.value ?? 0), 0);
  const chassisPrice = OLD_CHASSIS_PRICES[(gwy.chassis ?? 1) - 1] ?? 0;
  const back = parts + stock + chassisPrice;
  g.player.credits += back;
  const start = componentsOf('cpu')[0];
  g.player.gateway = { chassis: 1, ip: gwy.ip ?? '', migrateUntil: 0, parts: [{ kind: 'cpu', level: start.tier, name: start.name }] };
  g.player.stock = [];
  g.version = SAVE_VERSION;
  if (!Array.isArray(g.log)) g.log = [];
  g.log.push({ minute: g.clock?.minutes ?? 0, text: `new hardware catalogue // the old rig was paid back: ${back} cr` });
}

/// A run saved before people had records: each gets the record a new world of
/// the same seed would give them, and the sex of their first name.
function fillRecords(g) {
  (g.world.people ?? []).forEach((p, i) => {
    const r = personRecord(p.name, i);
    p.sex ??= firstNames().find((f) => f.name === p.name.split(' ')[0])?.sex ?? 'M';
    p.status ??= r.status;
    p.criminalRecord ??= r.criminalRecord;
    p.ssn ??= r.ssn;
  });
}

/// A run saved before the offers revealed their target: the machine of every
/// live job is put on the map, so no job is stranded.
function revealLiveTargets(g) {
  (g.contracts ?? []).forEach((c) => {
    if (!['offered', 'accepted', 'ready'].includes(c.state)) return;
    const h = g.world.hosts[c.target];
    if (h) h.discovered = true;
  });
}

/// A world made when the cracker had five versions and the voice cloner three:
/// no lock asks for more than v3 now, and a voice lock for v1.
function clampLocks(g) {
  (g.world?.hosts ?? []).forEach((h) => {
    (h.services ?? []).forEach((v) => {
      v.password = v.kind === 'voice' ? Math.min(v.password, 1) : Math.min(v.password, 3);
    });
    // a world from before MFA gets the guards its hosts would have been given
    assignAuth(h);
  });
  // and the crown hosts become internal segments
  if (g.world) markInternal(g.world);
}

/// A run that owns a tool level the catalogue no longer sells: the tool is cut
/// back to its last level and the price of the levels above it is paid back.
function cutLostLevels(g) {
  // a tool the catalogue no longer has (PROBE, HUD, LANSCAN) is simply dropped
  g.player.tools = (g.player.tools ?? []).filter((t) => software().some((d) => d.kind === t.kind));
  g.player.tools.forEach((t) => {
    const def = software().find((d) => d.kind === t.kind);
    const last = def?.versions.length;
    if (!def || t.level <= last) return;
    const back = Math.max(toolPrice(def, t.level) - toolPrice(def, last), 0);
    g.player.credits += back;
    t.level = last;
    if (!Array.isArray(g.log)) g.log = [];
    g.log.push({ minute: g.clock.minutes, text: `${def.short} cut back to v${last} // ${back} cr paid back` });
  });
}

/// A run saved before the board only offered jobs that can be finished: a job
/// of a kind that never had a task behind it is put back on the shelf, and a
/// retrieve whose file went missing or went encrypted is pointed at a file
/// that can still be taken.
function repairLiveJobs(g) {
  (g.contracts ?? []).forEach((c) => {
    if (c.state !== 'offered' && c.state !== 'accepted') return;
    if (['transfer', 'model', 'story'].includes(c.kind) || (c.kind === 'modify' && !c.record)) {
      c.state = 'expired';
      logRepair(g, c);
      return;
    }
    if (c.kind !== 'retrieve') return;
    const h = g.world.hosts[c.target];
    if (!h) {
      c.state = 'expired';
      logRepair(g, c);
      return;
    }
    const named = h.files.find((x) => x.name === c.file);
    if (named && !named.deleted && named.enc === 0) return;
    if ((g.player.storage ?? []).some((x) => x.tag === c.id)) return;
    const other = h.files.find((x) => !x.deleted && x.enc === 0 && x.tag === 0);
    if (!other) {
      c.state = 'expired';
      logRepair(g, c);
      return;
    }
    if (named) c.brief = (c.brief ?? '').split(named.name).join(other.name);
    c.file = other.name;
    c.subject = other.name;
  });
}

/// Writes a line in the operator's log about a job put back on the shelf.
function logRepair(g, c) {
  if (!Array.isArray(g.log)) g.log = [];
  g.log.push({ minute: g.clock.minutes, text: `contract ${c.id} put back // the work was not there to be done` });
}

/// Is the parsed save a run this build can play? An older version or a
/// damaged file is turned away; it stays in the store, untouched.
function isSound(g) {
  return (
    !!g && typeof g === 'object' && g.version === SAVE_VERSION &&
    !!g.player && typeof g.player.handle === 'string' &&
    !!g.clock && Number.isFinite(g.clock.minutes) &&
    !!g.world && Array.isArray(g.world.hosts)
  );
}

/// Saves the live run when the page is closed or hidden, as the autosave
/// would. An ended run is never written over the last good one.
export function saveOnLeave(win, state) {
  const leave = () => {
    const g = state.game;
    if (g && !g.gameOver && g.settings.autosave) saveRun(g);
  };
  win.addEventListener('pagehide', leave);
  win.document?.addEventListener('visibilitychange', () => {
    if (win.document.visibilityState === 'hidden') leave();
  });
}

/// Is there a run to go back to? A damaged old save still counts.
export function hasRun() {
  try {
    return saveKeys().length > 0 || !!store().getItem(LEGACY);
  } catch (e) {
    console.error('save: could not delete', e);
    return false;
  }
}

/// Throws an operator's saved run away. The terminal keeps no copy of it.
export function deleteRun(handle = current) {
  if (handle == null) return false;
  try {
    store().removeItem(keyOf(handle));
    globalThis.blackgate?.removeReport?.(safeName(handle));
    return true;
  } catch {
    return false;
  }
}

/// The welcome screen's saved operators, one line each; unreadable saves are
/// left out.
export function listSlots() {
  const keep = current;
  const out = saveKeys().map((k) => slotInfo(k.slice(PREFIX.length))).filter(Boolean);
  current = keep; // listing is not loading
  return out.sort((a, b) => a.handle.localeCompare(b.handle));
}

/// The line the welcome screen shows for one operator's saved run.
export function slotInfo(handle = current) {
  const g = loadRun(handle);
  if (!g) return null;
  return {
    slot: safeName(g.player.handle),
    handle: g.player.handle,
    rank: rankName(g.player.rating),
    credits: g.player.credits,
    day: Math.floor(g.clock.minutes / 1440) + 1,
  };
}


/// The most saved profiles a terminal keeps.
export const MAX_PROFILES = 4;

/// Whether a new run under this handle needs a fifth profile. A handle that
/// is already saved replaces its own profile, so it never does.
export function profilesFull(slots, handle) {
  const name = safeName((handle ?? '').trim() || 'OPERATOR');
  if (slots.some((s) => safeName(s.handle) === name)) return false;
  return slots.length >= MAX_PROFILES;
}
