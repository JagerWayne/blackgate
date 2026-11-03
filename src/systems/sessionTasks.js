// The work a link carries out: the tasks, what they need and what they do.

import { freeLane, pushLine } from '../state/session.js';
import { toolLevel, storageUsed, keepsRecord, validRecord } from '../state/gameState.js';
import { crypt, fpga, hasHsm, storage } from '../state/gateway.js';
import { authOf, inboxAuth, hijackerLevel, AUTH_LABEL, AUTH_LEVEL } from '../data/auth.js';
import { copyRate } from '../state/transfer.js';
import { roomFor, SATURATED } from './compute.js';
import { software } from '../data/content.js';
import { voiceAdmin, hasSample } from '../state/voice.js';
import { knows, spammed } from '../state/intel.js';

/// What a task says while the link is still being negotiated.
export const LINK_DOWN = 'link not up yet';

/// Starts a task on the link.
export function startTask(game, kind, arg) {
  const s = game.session;
  if (!s) return 'not connected';
  if (s.phase !== 'online') return LINK_DOWN;
  if (!roomFor(game, s, kind)) return SATURATED;
  const h = game.world.hosts[s.target];
  const spec = planTask(game, s, h, kind, arg);
  if (spec.error) return spec.error;
  s.tasks.push({ kind, arg, label: spec.label, progress: 0, dur: spec.dur, lane: freeLane(s, s.tasks.length + 1) });
  pushLine(s, `> ${spec.label}`);
  if (spec.loud) {
    s.alerted = true;
    s.trace = Math.min(s.trace + 0.08, 1);
  }
  return null;
}

/// The reason a task cannot run on this link, or null when it can. The
/// windows ask this before they offer the task, so a button that cannot work
/// says why instead of failing after the click.
export function taskError(game, s, kind, arg) {
  if (!s) return 'not connected';
  if (s.phase !== 'online') return LINK_DOWN;
  if (!roomFor(game, s, kind)) return SATURATED;
  const h = game.world.hosts[s.target];
  if (!h) return 'no such host';
  const spec = planTask(game, s, h, kind, arg);
  return spec.error ?? null;
}

/// The tasks that make no sense twice on the same target at once.
const ONE_AT_A_TIME = new Set(['BypassFirewall', 'BypassMonitor', 'BypassProxy', 'Ddos', 'CrackPassword', 'HijackSession', 'DeleteFile']);

const VOICE_TASKS = new Set(['RecordVoice', 'CallRecord', 'SpoofCall']);

/// The gateway storage the running tasks will still take: the copies, and one
/// GB for each voice sample being recorded.
function pendingStorage(s, h) {
  return s.tasks.reduce((n, t) => n + (t.kind === 'CopyFile' ? (h.files[t.arg]?.size ?? 0) : VOICE_TASKS.has(t.kind) ? 1 : 0), 0);
}

/// Works out what a task needs and how long it takes.
function planTask(game, s, h, kind, arg) {
  const need = toolFor(kind);
  if (need && toolLevel(game, need) === 0) return { error: `no ${need} installed` };
  if (ONE_AT_A_TIME.has(kind) && s.tasks.some((t) => t.kind === kind && t.arg === arg)) return { error: 'already running' };
  switch (kind) {
    case 'BypassFirewall': {
      const lvl = toolLevel(game, 'FirewallBypass');
      if (lvl < h.firewall) return { error: 'firewall bypass too weak' };
      if (s.fwBypassed) return { error: 'firewall already bypassed' };
      return { label: 'bypass firewall', dur: 2.5 + h.firewall * 1.6, loud: false };
    }
    case 'BypassMonitor':
      if (toolLevel(game, 'MonitorBypass') < h.monitor) return { error: 'monitor bypass too weak' };
      if (s.monBypassed) return { error: 'monitor already blinded' };
      return { label: 'blind monitor', dur: 3.5 + h.monitor * 1.2, loud: false };
    case 'BypassProxy': {
      if (h.proxy === 0) return { error: 'no proxy on this host' };
      if (s.proxyBypassed) return { error: 'proxy already scrubbed' };
      const lvl = toolLevel(game, 'ProxyBypass');
      if (lvl < h.proxy) return { error: 'proxy bypass too weak' };
      return { label: 'scrub proxy trail', dur: 2.5 + h.proxy * 0.9, loud: false };
    }
    case 'Ddos': {
      // one flood drops both the firewall and the proxy, if the cannon is strong enough for each
      const fw = h.firewall > 0 && !s.fwBypassed;
      const px = h.proxy > 0 && !s.proxyBypassed;
      if (!fw && !px) return { error: 'nothing to drop' };
      const lvl = toolLevel(game, 'DdosCannon');
      if (fw && lvl < h.firewall) return { error: `cannon too weak for the firewall (FW ${h.firewall})` };
      if (px && lvl < h.proxy) return { error: `cannon too weak for the proxy (PX ${h.proxy})` };
      return { label: 'volumetric flood', dur: 4, loud: true };
    }
    case 'HijackSession': {
      // an adversary-in-the-middle capture of a live session: no password, a token that lasts a while
      const svc = h.services[arg];
      if (!svc) return { error: 'no such service' };
      if (svc.open) return { error: 'service already open' };
      const auth = authOf(svc);
      if (auth !== 'mfa' && auth !== 'session') return { error: 'no MFA to hijack on this service' };
      const lvl = toolLevel(game, 'SessionHijacker');
      if (lvl < AUTH_LEVEL[auth]) return { error: `hijacker v${lvl} cannot beat ${AUTH_LABEL[auth]}` };
      return { label: `hijack session ${svc.name}:${svc.port}`, dur: 5 + AUTH_LEVEL[auth] * 2, loud: false };
    }
    case 'CrackPassword': {
      const svc = h.services[arg];
      if (!svc) return { error: 'no such service' };
      if (svc.open) return { error: 'service already open' };
      if (svc.kind === 'voice') return { error: "voice lock // needs the admin's voiceprint" };
      // behind MFA a password is not enough; a hardware token wants the HSM tap
      const auth = authOf(svc);
      if (auth === 'mfa' || auth === 'session') return { error: `${AUTH_LABEL[auth]} // a password is not enough: needs the SESSION TOKEN HIJACKER` };
      if (auth === 'token' && !hasHsm(game.player.gateway)) return { error: 'hardware token // fit an HSM TAP' };
      const lvl = toolLevel(game, 'PasswordCracker');
      if (lvl < svc.password) return { error: `breaker v${lvl} cannot beat lock v${svc.password}` };
      const dur = (2.5 + svc.password * 2.2) / crypt(game.player.gateway);
      return { label: `crack ${svc.name}:${svc.port}`, dur: Math.max(dur, 0.6), loud: true };
    }
    case 'CopyFile': {
      const f = h.files[arg];
      if (!f || f.deleted) return { error: 'file no longer exists' };
      if (f.enc > 0) return { error: 'file is encrypted' };
      if (s.tasks.some((t) => t.kind === 'CopyFile' && t.arg === arg)) return { error: 'already copying this file' };
      // work still running counts too, or two at once overfill the drive
      if (storageUsed(game) + pendingStorage(s, h) + f.size > storage(game.player.gateway)) return { error: 'not enough gateway storage' };
      return { label: `copy ${f.name}`, dur: Math.max(f.size / copyRate(game.player.gateway), 1.2), loud: true };
    }
    case 'DecryptFile': {
      const f = h.files[arg];
      if (!f || f.deleted) return { error: 'no such file' };
      if (f.enc === 0) return { error: 'file is not encrypted' };
      if (s.tasks.some((t) => t.kind === 'DecryptFile' && t.arg === arg)) return { error: 'already decrypting this file' };
      const lvl = toolLevel(game, 'Decrypter');
      if (lvl < f.enc) return { error: `decrypter v${lvl} cannot open v${f.enc}` };
      const dur = (2 + f.enc * 3) / (crypt(game.player.gateway) * fpga(game.player.gateway));
      return { label: `decrypt ${f.name}`, dur: Math.max(dur, 0.6), loud: true };
    }
    case 'DeleteFile': {
      const f = h.files[arg];
      if (!f || f.deleted) return { error: 'no such file' };
      if (s.tasks.some((t) => t.kind === 'CopyFile' && t.arg === arg)) return { error: 'file is being copied' };
      return { label: `destroy ${f.name}`, dur: 3 + f.size / 12, loud: true };
    }
    case 'WipeLogs':
      if (!h.logs.length) return { error: 'no logs to wipe' };
      return { label: 'wipe logs', dur: 2.5 + h.logs.length * 0.2, loud: true };
    case 'ModifyLogs': {
      // quiet: it rewrites only the operator's own lines, so no alarm trips
      const mine = h.logs.filter((l) => l.ip === game.player.gateway.ip).length;
      if (!mine) return { error: 'no logs of yours here' };
      return { label: 'scrub own logs', dur: 3 + mine * 0.3, loud: false };
    }
    case 'AlterRecord': {
      const { person, field, value } = arg ?? {};
      const p = game.world.people[person];
      if (!p) return { error: 'no such person' };
      if (!validRecord(game, field, value)) return { error: `not a valid ${field}` };
      if (!keepsRecord(game, h, person, field)) return { error: `${field} is not kept here` };
      const svc = h.services.find((v) => v.kind === 'records' && v.open);
      if (!svc) return { error: 'records service is locked' };
      if (p[field] === value) return { error: 'the record already reads that' };
      if (s.tasks.some((t) => t.kind === 'AlterRecord' && t.arg?.person === person && t.arg?.field === field)) {
        return { error: 'already altering this record' };
      }
      return { label: `alter ${p.name} // ${field}`, dur: 3 + svc.password * 1.5, loud: true };
    }
    case 'OsintSweep':
      return { label: 'osint sweep', dur: 6, loud: false };
    case 'RecordVoice': {
      // arg: the voice service; the call goes to the lock's admin
      const svc = h.services[arg];
      if (svc?.kind !== 'voice') return { error: 'not a voice lock' };
      const who = voiceAdmin(game, h);
      if (who === null) return { error: 'nobody to call' };
      if (!knows(game, who, 'phone')) return { error: "the admin's phone is unknown // PROFILE them on the PEOPLE tab" };
      if (hasSample(game, who)) return { error: 'voice already recorded' };
      if (s.tasks.some((t) => t.kind === 'RecordVoice')) return { error: 'already on a call' };
      if (storageUsed(game) + pendingStorage(s, h) + 1 > storage(game.player.gateway)) return { error: 'no room on the gateway' };
      return { label: `call ${game.world.people[who].name}`, dur: 8, loud: false };
    }
    case 'Profile':
    case 'CallRecord':
    case 'SpoofCall':
    case 'TapPhone':
    case 'HackInbox':
    case 'Phish':
    case 'Spam':
      return planPeople(game, s, h, kind, arg);
    case 'PlayVoiceprint': {
      const svc = h.services[arg];
      if (svc?.kind !== 'voice') return { error: 'not a voice lock' };
      if (svc.open) return { error: 'service already open' };
      const who = voiceAdmin(game, h);
      if (who === null || !hasSample(game, who)) return { error: "record the admin's voice first" };
      const lvl = toolLevel(game, 'VoiceAnalyser');
      if (lvl < svc.password) return { error: `analyser v${lvl} cannot match lock v${svc.password}` };
      return { label: `voiceprint ${svc.name}:${svc.port}`, dur: Math.max((3 + svc.password) / crypt(game.player.gateway), 0.6), loud: false };
    }
    default:
      return { error: 'not a task' };
  }
}

/// The people tasks: arg is the person, who must work at the linked host's
/// company. Each says what it still needs.
function planPeople(game, s, h, kind, i) {
  const p = game.world.people[i];
  if (!p) return { error: 'no such person' };
  if (h.company == null || p.company !== h.company) return { error: `link to a host of ${game.world.companies[p.company]?.name ?? 'their company'} first` };
  // a read: asking whether a task can run must not put the person on file
  const it = game.intel?.[i] ?? { level: 0 };
  const busy = s.tasks.some((t) => t.kind === kind && t.arg === i);
  if (busy) return { error: 'already running on this person' };
  const phone = knows(game, i, 'phone');
  const email = knows(game, i, 'email');
  switch (kind) {
    case 'Profile': {
      const lvl = Math.min(toolLevel(game, 'OsintSweep'), 4);
      if (it.level >= lvl) return { error: it.level >= 4 ? 'nothing more to find' : `OSINT v${lvl} has found all it can` };
      return { label: `profile ${p.name}`, dur: 4 + lvl, loud: false };
    }
    case 'CallRecord':
    case 'SpoofCall': {
      if (!phone) return { error: 'phone unknown // PROFILE with OSINT v2+' };
      if (hasSample(game, i)) return { error: 'voice already recorded' };
      if (storageUsed(game) + pendingStorage(s, h) + 1 > storage(game.player.gateway)) return { error: 'no room on the gateway' };
      if (kind === 'SpoofCall' && toolLevel(game, 'VoiceAnalyser') === 0) return { error: 'no VoiceAnalyser installed' };
      const spoof = kind === 'SpoofCall';
      // a spoofed call is synthesised, so the accelerator shortens it; a recorded one runs in real time
      return { label: `${spoof ? 'spoofed call' : 'call'} ${p.name}`, dur: spoof ? Math.max(14 / crypt(game.player.gateway), 1.8) : 8, loud: false };
    }
    case 'TapPhone':
      if (!phone) return { error: 'phone unknown // PROFILE with OSINT v2+' };
      if (it.tapped) return { error: 'phone already tapped' };
      if (toolLevel(game, 'SpoofKit') < 2) return { error: 'taps need SPOOF KIT v2' };
      return { label: `tap ${p.name}`, dur: 10, loud: true };
    case 'HackInbox': {
      if (!email) return { error: 'email unknown // PROFILE them first' };
      if (it.inbox) return { error: 'inbox already hacked' };
      // behind MFA neither a stuffed nor a cracked password gets in: the session has to be hijacked
      const guard = inboxAuth(game.world, p.company);
      if (guard !== 'password') {
        const need = hijackerLevel(guard);
        if (toolLevel(game, 'SessionHijacker') < need) {
          return { error: `their login is behind ${AUTH_LABEL[guard]}: stuffing and brute force are blocked // needs a SESSION TOKEN HIJACKER v${need}` };
        }
        return { label: `hijack inbox ${p.email}`, dur: 8, loud: false };
      }
      const stuff = knows(game, i, 'leak') && toolLevel(game, 'CredentialStuff') > 0;
      const brute = toolLevel(game, 'PasswordCracker') >= p.clearance;
      if (!stuff && !brute) return { error: `needs their leaked password + CREDENTIAL STUFFING ENGINE, or a cracker v${p.clearance}` };
      return { label: `hack inbox ${p.email}`, dur: stuff ? 4 : 6 + p.clearance * 2, loud: !stuff };
    }
    case 'Phish':
      if (!email) return { error: 'email unknown // PROFILE them first' };
      if (it.inbox) return { error: 'inbox already hacked' };
      if (it.phishAt !== undefined) return { error: 'a phish is already waiting on them' };
      return { label: `phish ${p.email}`, dur: 5, loud: false };
    case 'Spam':
      if (!email) return { error: 'email unknown // PROFILE them first' };
      if (spammed(game, i)) return { error: 'their inbox is still buried' };
      return { label: `spam ${p.email}`, dur: 4, loud: false };
    default:
      return { error: 'not a task' };
  }
}

/// The tool a task needs.
export function toolFor(kind) {
  switch (kind) {
    case 'BypassFirewall': return 'FirewallBypass';
    case 'BypassMonitor': return 'MonitorBypass';
    case 'BypassProxy': return 'ProxyBypass';
    case 'Ddos': return 'DdosCannon';
    case 'HijackSession': return 'SessionHijacker';
    case 'CrackPassword': return 'PasswordCracker';
    case 'CopyFile': return 'FileCopier';
    case 'DecryptFile': return 'Decrypter';
    case 'DeleteFile': return 'FileDeleter';
    case 'WipeLogs': return 'LogDeleter';
    case 'ModifyLogs': return 'LogModifier';
    case 'OsintSweep': return 'OsintSweep';
    case 'RecordVoice': return 'VoiceAnalyser';
    case 'PlayVoiceprint': return 'VoiceAnalyser';
    case 'Profile': return 'OsintSweep';
    case 'CallRecord': return 'VoiceAnalyser';
    case 'SpoofCall': return 'SpoofKit';
    case 'TapPhone': return 'SpoofKit';
    case 'Phish': return 'SpoofKit';
    case 'Spam': return 'SpoofKit';
    default: return null;
  }
}
