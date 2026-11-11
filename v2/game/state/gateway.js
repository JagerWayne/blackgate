// The gateway: a chassis and the parts bolted into it. Every number the
// shell shows is derived from what is installed.

import { chassisDef, boardDef, componentDef } from '../data/content.js';
import { HW_LABEL } from '../data/enums.js';

/// What the Micro PC starts with: a processor, an eMMC chip soldered to the
/// board that holds the system and the apps, a 64 GB SSD for downloads and a
/// network card soldered to the board.
export function starterParts() {
  const part = (kind, tier, extra = {}) => ({ kind, level: tier, name: componentDef(kind, tier).name, ...extra });
  return [part('cpu', 1), part('storage', EMMC_TIER, { fixed: true, role: 'system' }), part('storage', STARTER_DRIVE, { role: 'downloads' }), part('modem', 1, { fixed: true })];
}

/// The tier of the soldered eMMC drive in the catalogue (it is not for sale).
export const EMMC_TIER = 31;

/// The tier of the 64 GB M.2 SSD the Micro PC starts with for downloads.
export const STARTER_DRIVE = 2;

/// The case (chassis), the motherboard in it and the parts on the board.
export function makeGateway() {
  return { chassis: 1, board: 1, parts: [], ip: '', migrateUntil: 0 };
}

/// The chassis the gateway runs on.
export function chassisOf(gw) { return chassisDef(gw.chassis); }

/// The motherboard in the case.
export function boardOf(gw) { return boardDef(gw.board ?? 1); }

/// Whether a board fits a case: the board must not be bigger than the case.
export function boardFits(chassis, board) { return board.form <= chassis.form; }

/// How many parts of a kind the machine takes. The board gives the processor,
/// card and network slots; drives need a bay in the case too; the case gives
/// the security slots.
export function slotsFor(gw, kind) {
  const c = chassisOf(gw);
  const b = boardOf(gw);
  switch (kind) {
    case 'cpu': return b.cpu_slots;
    case 'accel': return b.accel_slots;
    case 'fpga': return b.fpga_slots;
    case 'hsm': return b.hsm_slots;
    case 'storage': return Math.min(b.storage_slots, c.bays);
    case 'modem': return b.modem_slots;
    case 'security': return c.security_slots;
    default: return 0;
  }
}

/// The best tier of a processor the board runs, or Infinity for a kind with no tier limit.
export function tierCap(gw, kind) {
  if (kind === 'cpu') return boardOf(gw).cpu_max;
  return Infinity;
}

const gbText = (n) => (n >= 1024 ? `${n / 1024} TB` : `${n} GB`);

/// Why the board cannot take a part of this kind and tier, or '': a processor
/// above the best it runs, a drive with a connector the board lacks or bigger
/// than the board takes.
export function partLimit(gw, kind, level) {
  const b = boardOf(gw);
  if (kind === 'cpu') return level > b.cpu_max ? `the board runs processors up to tier ${b.cpu_max}` : '';
  if (kind !== 'storage') return '';
  const d = componentDef('storage', level);
  if (!d || d.onboard) return '';
  if (!b.drive_types.includes(d.drive_type)) return `this board has no ${d.form} ${d.rpm ? 'hard disk' : 'SSD'} connector`;
  if (d.capacity > b.drive_cap) return `this board takes drives up to ${gbText(b.drive_cap)}`;
  return '';
}

/// Whether the board takes a part of this kind and tier.
export function fitsBoard(gw, kind, level) { return partLimit(gw, kind, level) === ''; }

/// A part soldered on (the Micro PC's network card): it cannot be taken out.
export function isFixed(part) { return !!part?.fixed; }

/// How many components of a kind are fitted.
export function usedSlots(gw, kind) { return gw.parts.filter((p) => p.kind === kind).length; }

/// The kinds that must be one model across every slot.
const MATCHED = new Set(['cpu']);

/// Whether every fitted part of a kind must be the same model.
export function matched(kind) { return MATCHED.has(kind); }

/// The model (tier) of a matched set, or null when none is fitted.
export function fittedModel(gw, kind) { return partsOf(gw, kind)[0]?.level ?? null; }

/// What buying a part would do: how many go in, which fitted parts come out
/// (to stock), and why it cannot be done ('' when it can).
export function fitPlan(gw, def) {
  const kind = def.kind;
  const fitted = partsOf(gw, kind);
  const slots = slotsFor(gw, kind);
  const label = kindLabel(kind);
  if (!slots) return { add: 0, out: [], why: `no ${label} slot on this board` };
  const limit = partLimit(gw, kind, def.tier);
  if (limit) return { add: 0, out: [], why: limit };
  if (matched(kind) && fitted.length && fitted[0].level !== def.tier) {
    // a new model replaces the whole set: one goes in, more follow
    return { add: 1, out: fitted, why: '' };
  }
  if (fitted.length < slots) return { add: 1, out: [], why: '' };
  if (matched(kind)) return { add: 0, out: [], why: `all ${label} slots full` };
  // a full kind that is not matched swaps its oldest part out, unless it is soldered on
  const loose = fitted.filter((p) => !p.fixed);
  if (!loose.length) return { add: 0, out: [], why: `the ${label} is soldered on and cannot be replaced` };
  return { add: 1, out: [loose[0]], why: '' };
}

/// The components of a kind that are fitted.
export function partsOf(gw, kind) { return gw.parts.filter((p) => p.kind === kind); }

/// The index in `parts` of the n-th fitted part of a kind, or -1 when that slot is free.
export function slotIndex(gw, kind, n) {
  const p = partsOf(gw, kind)[n];
  return p ? gw.parts.indexOf(p) : -1;
}

/// The catalogue entries of the fitted security parts: they work together.
function securityDefs(gw) {
  return partsOf(gw, 'security').map((p) => componentDef('security', p.level)).filter(Boolean);
}

/// The thread slots: how many tools the processors run at full speed.
export function lanes(gw) {
  return partsOf(gw, 'cpu').reduce((n, p) => n + (componentDef('cpu', p.level)?.lanes ?? 0), 0);
}

/// The speed-up cracking, decrypting and voice synthesis get from the
/// accelerator card (the best one fitted).
export function crypt(gw) {
  return Math.max(1, ...partsOf(gw, 'accel').map((p) => componentDef('accel', p.level)?.multiplier ?? 1));
}

/// The speed-up of decryptions and handshakes on the FPGA, 1 without one.
export function fpga(gw) {
  return Math.max(1, ...partsOf(gw, 'fpga').map((p) => componentDef('fpga', p.level)?.multiplier ?? 1));
}

/// The drive space, in GB: every drive fitted.
export function storage(gw) {
  return partsOf(gw, 'storage').reduce((n, p) => n + (componentDef('storage', p.level)?.capacity ?? 0), 0);
}

// -- the drives: bay 1 holds the system (the apps), the other bays the downloads ------------

/// The drives fitted.
export function drives(gw) { return partsOf(gw, 'storage'); }

/// A machine with one drive shares it between the system and the downloads.
export function sharedDrive(gw) { return drives(gw).length <= 1; }

/// The system drive (C:) is the drive in the first bay; the others are storage drives (D:).
export function systemDrive(gw) { return drives(gw)[0] ?? null; }

/// The Device Manager's name for a drive: SYS Drive (bay 1, C:), STR Drive 1, 2, ... (the other bays, D:).
export function driveName(gw, part) {
  const n = drives(gw).indexOf(part);
  return n <= 0 ? 'SYS Drive' : `STR Drive ${n}`;
}

/// The drives the downloads go to: all but the system drive, or the one drive when it is shared.
export function downloadDrives(gw) {
  const all = drives(gw);
  if (all.length <= 1) return all;
  const sys = systemDrive(gw);
  return all.filter((p) => p !== sys);
}

/// Makes the roles tidy after any change to the drives: exactly one system
/// drive (the one marked, else the first) and every other drive for downloads.
export function settleRoles(gw) {
  const all = drives(gw);
  const sys = systemDrive(gw);
  all.forEach((p) => { p.role = p === sys ? 'system' : 'downloads'; });
}

const capOf = (p) => componentDef('storage', p.level)?.capacity ?? 0;
const sumCap = (list) => list.reduce((n, p) => n + capOf(p), 0);

/// The GB the apps may take: the system drive, or the whole drive when shared.
export function systemCap(gw) { return sharedDrive(gw) ? sumCap(drives(gw)) : capOf(systemDrive(gw)); }

/// The GB the downloads may take: the download drives, or the whole drive when shared.
export function downloadCap(gw) { return sumCap(downloadDrives(gw)); }

/// How fast the apps run. A hard disk as the system drive runs them slower
/// (60%); a solid-state drive does not.
export function systemSpeed(gw) {
  const d = systemDrive(gw);
  return d ? componentDef('storage', d.level)?.sys_speed ?? 1 : 1;
}

/// How fast downloads run on the drives they go to, 1 for solid-state: the
/// average of the drives' speeds weighted by their size (the files mostly sit
/// on the big slow disk), so a cheap hard disk trades speed for room.
export function driveSpeed(gw) {
  const list = downloadDrives(gw).map((p) => componentDef('storage', p.level)).filter(Boolean);
  const total = list.reduce((n, d) => n + d.capacity, 0);
  return total ? list.reduce((n, d) => n + d.capacity * (d.speed ?? 1), 0) / total : 1;
}

/// The link bandwidth, in Mbps: every network card fitted (they add up).
export function bandwidth(gw) {
  return partsOf(gw, 'modem').reduce((n, p) => n + (componentDef('modem', p.level)?.bandwidth ?? 0), 0);
}

/// The route hops carried without a latency penalty: every network card
/// carries its own, and they add up (a card for 2 and a card for 4 carry 6).
export function hops(gw) {
  return partsOf(gw, 'modem').reduce((n, p) => n + (componentDef('modem', p.level)?.hops ?? 0), 0);
}

/// How much the security units slow an active trace.
function traceDelay(gw) { return Math.max(0, ...securityDefs(gw).map((d) => d.trace_delay)); }

/// The share of a raid the security units absorb: the best of them, or the
/// chassis's own surge protector.
export function raidShield(gw) { return Math.max(chassisOf(gw).base_shield ?? 0, ...securityDefs(gw).map((d) => d.raid_shield)); }

/// Whether the perimeter sensors are fitted: they show the Green, Yellow and Red bands.
export function hasSensors(gw) { return securityDefs(gw).some((d) => d.hud); }

/// Whether the HSM tap is fitted: it opens the hardware-token locks.
export function hasHsm(gw) { return partsOf(gw, 'hsm').length > 0; }

/// Whether an RF jammer is fitted.
export function hasJammer(gw) { return securityDefs(gw).some((d) => d.jammer); }

/// The trace level at which the security units warn: the earliest of them.
export function warnAt(gw) { return Math.min(0.85, ...securityDefs(gw).map((d) => d.warn_at)); }

/// What the security units do when a raid reaches the end.
export function failsafe(gw) {
  return ownFailsafe(gw) || (chassisOf(gw).emergency_purge ? 'PURGE' : '');
}

/// The failsafe a security part itself carries, or '' (the chassis purge
/// does not count).
export function ownFailsafe(gw) { return securityDefs(gw).find((d) => d.failsafe)?.failsafe || ''; }

/// The defence the security units provide.
export function defense(gw) {
  const names = securityDefs(gw).map((d) => d.defense).filter(Boolean);
  return names.length ? names.join(' + ') : 'NO PROTECTION';
}

/// The modem that sets the line: the fastest fitted.
function lineModem(gw) {
  return partsOf(gw, 'modem').map((p) => componentDef('modem', p.level)).filter(Boolean).sort((a, b) => b.tier - a.tier)[0];
}

/// How easily the line is followed: a fixed fibre line is easy, a dish has no wire.
function lineFactor(gw) { return lineModem(gw)?.trace_mult ?? 1; }

/// The seconds of activity after which an orbital dish is located, or 0.
export function triangulation(gw) { return lineModem(gw)?.triangulated ?? 0; }

/// How fast a passive trace finds the machine.
export function traceFactor(gw) { return chassisOf(gw).trace_factor * (1 - 0.07 * traceDelay(gw)) * lineFactor(gw); }

/// How fast heat builds on the operator.
export function heatFactor(gw) { return chassisOf(gw).heat_factor; }

/// Whether the chassis is being reconfigured.
export function migrating(gw, now) { return now < gw.migrateUntil; }

/// The minutes the migration still needs.
export function migrateLeft(gw, now) { return Math.max(gw.migrateUntil - now, 0); }

/// The label of a component kind.
export function kindLabel(kind) { return HW_LABEL[kind] ?? kind.toUpperCase(); }
