// Thread slots: what the running tasks ask of the processors, how far an
// overload slows them and what it costs the operator when it lasts.

import { lanes, fpga } from '../state/gateway.js';
import { pushLine } from '../state/session.js';

/// The tasks that take two thread slots: the crackers, the decrypters and the
/// voice work. Every other task takes one.
const HEAVY = new Set(['CrackPassword', 'DecryptFile', 'RecordVoice', 'CallRecord', 'SpoofCall', 'PlayVoiceprint', 'ForgeTicket']);

/// A demand above this many times the slots is an overload...
const OVERLOAD_AT = 1.5;

/// ...that costs a bypass once it has lasted this many seconds.
export const OVERLOAD_SECS = 20;

/// No task starts when the demand would pass this many times the slots.
const CAP = 2;

/// What a task says when the processors take no more work.
export const SATURATED = 'processors saturated';

/// The bypasses a link can hold: the flag that says it is in place, the host
/// level it beats (the weakest goes first) and what the log says when it goes.
const BYPASS = {
  BypassFirewall: { flag: 'fwBypassed', level: (h) => h.firewall, line: 'firewall bypass lost' },
  BypassMonitor: { flag: 'monBypassed', level: (h) => h.monitor, line: 'monitor blinder lost' },
  BypassProxy: { flag: 'proxyBypassed', level: (h) => h.proxy, line: 'proxy scrub lost' },
};

/// The thread slots the machine has.
export function slots(game) { return Math.max(lanes(game.player.gateway), 1); }

/// The thread slots a task takes. The FPGA decrypts on its own silicon.
export function weight(game, kind) {
  if (kind === 'DecryptFile' && fpga(game.player.gateway) > 1) return 0;
  return HEAVY.has(kind) ? 2 : 1;
}

/// The thread slots the running tasks ask for.
export function demand(game, s) { return s.tasks.reduce((n, t) => n + weight(game, t.kind), 0); }

/// The share of its speed each task keeps: all of it within the slots, slots
/// over demand past them.
export function throttle(game, s) { return Math.min(1, slots(game) / Math.max(demand(game, s), 1)); }

/// Whether a task of this kind still fits on the processors.
export function roomFor(game, s, kind) { return demand(game, s) + weight(game, kind) <= CAP * slots(game); }

/// Counts the seconds the machine has been overloaded. At the limit the
/// weakest bypass goes and the digital trace starts.
export function overloadTick(game, s, dt) {
  if (demand(game, s) <= OVERLOAD_AT * slots(game)) {
    s.overload = 0;
    return;
  }
  s.overload = (s.overload ?? 0) + dt;
  if (s.overload < OVERLOAD_SECS) return;
  s.overload = 0;
  dropWeakest(game, s);
}

/// Loses the bypass that beats the lowest level, one in place or one still
/// being worked on, and starts the trace.
function dropWeakest(game, s) {
  const h = game.world.hosts[s.target];
  const held = Object.keys(BYPASS).filter((kind) => s[BYPASS[kind].flag]).map((kind) => ({ kind }));
  const working = s.tasks.filter((t) => BYPASS[t.kind]).map((task) => ({ kind: task.kind, task }));
  // held bypasses come first, so on a tie the one in place is lost
  const [weakest] = [...held, ...working].sort((a, b) => BYPASS[a.kind].level(h) - BYPASS[b.kind].level(h));
  if (weakest?.task) s.tasks.splice(s.tasks.indexOf(weakest.task), 1);
  else if (weakest) undo(s, h, weakest.kind);
  s.alerted = true;
  pushLine(s, `overload // ${weakest ? BYPASS[weakest.kind].line : 'processors starved'} // trace started`);
  game.toasts.push({ text: 'Processors overloaded: a bypass dropped', kind: 'bad', born: game.uiTime });
}

/// Takes a bypass back: what it opened shuts and the trace it slowed speeds up.
function undo(s, h, kind) {
  s[BYPASS[kind].flag] = false;
  if (kind === 'BypassProxy') {
    h.services.filter((v) => v.kind === 'proxy').forEach((v) => { v.open = false; });
    s.traceRate /= 0.65;
  }
}
