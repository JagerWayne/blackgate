// The gateway: a chassis and the parts bolted into it. Every number the
// shell shows is derived from what is installed.

import { chassisDef, componentDef } from '../data/content.js';
import { HW_LABEL } from '../data/enums.js';

/// The chassis and the parts.
export function makeGateway() {
  return { chassis: 1, parts: [], ip: '', migrateUntil: 0 };
}

/// The chassis the gateway runs on.
export function chassisOf(gw) { return chassisDef(gw.chassis); }

/// How many components of a kind the chassis takes.
export function slotsFor(gw, kind) {
  const c = chassisOf(gw);
  switch (kind) {
    case 'cpu': return c.cpu_slots;
    case 'accel': return c.accel_slots ?? 0;
    case 'fpga': return c.fpga_slots ?? 0;
    case 'storage': return c.storage_slots ?? 1;
    case 'modem': return c.modem_slots;
    case 'security': return c.security_slots;
    default: return 0;
  }
}

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
  if (def.needs_rack && !chassisOf(gw).rack) return { add: 0, out: [], why: 'needs a rack chassis' };
  if (!slots) return { add: 0, out: [], why: `no ${label} slot on this chassis` };
  if (matched(kind) && fitted.length && fitted[0].level !== def.tier) {
    // a new model replaces the whole set: one goes in, more follow
    return { add: 1, out: fitted, why: '' };
  }
  if (fitted.length < slots) return { add: 1, out: [], why: '' };
  if (matched(kind)) return { add: 0, out: [], why: `all ${label} slots full` };
  // a full kind that is not matched swaps its oldest part out
  return { add: 1, out: [fitted[0]], why: '' };
}

/// The components of a kind that are fitted.
export function partsOf(gw, kind) { return gw.parts.filter((p) => p.kind === kind); }

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

/// The drive space, in GB: what the chassis carries onboard plus every card.
export function storage(gw) {
  return chassisOf(gw).onboard_storage + partsOf(gw, 'storage').reduce((n, p) => n + (componentDef('storage', p.level)?.capacity ?? 0), 0);
}

/// The link bandwidth, in Mbps: the chassis uplink plus every modem fitted
/// (they add up).
export function bandwidth(gw) {
  return chassisOf(gw).onboard_uplink + partsOf(gw, 'modem').reduce((n, p) => n + (componentDef('modem', p.level)?.bandwidth ?? 0), 0);
}

/// The route hops carried without a latency penalty.
export function hops(gw) {
  return partsOf(gw, 'modem').reduce((n, p) => Math.max(n, componentDef('modem', p.level)?.hops ?? 0), 0);
}

/// How much the security units slow an active trace.
function traceDelay(gw) { return Math.max(0, ...securityDefs(gw).map((d) => d.trace_delay)); }

/// The share of a raid the security units absorb: the best of them, or the
/// chassis's own surge protector.
export function raidShield(gw) { return Math.max(chassisOf(gw).base_shield ?? 0, ...securityDefs(gw).map((d) => d.raid_shield)); }

/// Whether the perimeter sensors are fitted: they show the Green, Yellow and Red bands.
export function hasSensors(gw) { return securityDefs(gw).some((d) => d.hud); }

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

/// How fast a passive trace finds the machine.
export function traceFactor(gw) { return chassisOf(gw).trace_factor * (1 - 0.07 * traceDelay(gw)); }

/// How fast heat builds on the operator.
export function heatFactor(gw) { return chassisOf(gw).heat_factor; }

/// Whether the chassis is being reconfigured.
export function migrating(gw, now) { return now < gw.migrateUntil; }

/// The minutes the migration still needs.
export function migrateLeft(gw, now) { return Math.max(gw.migrateUntil - now, 0); }

/// The label of a component kind.
export function kindLabel(kind) { return HW_LABEL[kind] ?? kind.toUpperCase(); }
