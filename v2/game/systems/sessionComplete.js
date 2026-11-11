// What a finished task did to the world.

import { pushLine } from '../state/session.js';
import { TOKEN_SECS } from '../data/auth.js';
import { REACH, difficultyOf, companyHosts, keyLocks } from '../data/network.js';
import { moveSession } from './lateral.js';
import { evaluateMissions } from '../state/contracts.js';
import { discover } from '../state/gameState.js';
import { voiceAdmin, sampleName } from '../state/voice.js';
import { intelOf, addLeads, useAccess, phishTaken, PHISH_MINUTES, SPAM_MINUTES, INTEL_FIELDS } from '../state/intel.js';
import { TASKS } from './tasks/index.js';
import { traitOf } from '../data/traits.js';
import { toolLevel, pushMail } from '../state/gameState.js';

/// Opens the proxy relays and slows the trace that goes through them.
function scrubProxy(s, h) {
  s.proxyBypassed = true;
  h.services.filter((v) => v.kind === 'proxy').forEach((v) => { v.open = true; });
  s.traceRate *= 0.65;
}

/// The task finished: the world changes.
export function completeTask(game, s, task) {
  const h = game.world.hosts[s.target];
  const ip = game.player.gateway.ip;
  if (TASKS[task.kind]) {
    TASKS[task.kind].done(game, s, task, h);
    return;
  }
  switch (task.kind) {
    case 'BypassProxy':
      scrubProxy(s, h);
      pushLine(s, 'proxy chain scrubbed // trace slowed');
      break;
    // the flood takes the firewall and the proxy down together; the whole
    // internet hears it, so the trace is on at once and three times as fast
    case 'Ddos':
      s.fwBypassed = true;
      if (h.proxy > 0 && !s.proxyBypassed) scrubProxy(s, h);
      s.alerted = true;
      s.traceRate *= 3;
      pushLine(s, 'volumetric flood // firewall and proxy down // the trace is on');
      break;
    case 'MapNetwork': {
      const reach = REACH[toolLevel(game, 'ZeroTrustMapper')];
      const found = companyHosts(game.world, h).filter((x) => !x.discovered && difficultyOf(x) <= reach);
      found.forEach((x) => discover(game, x.id));
      pushLine(s, `network mapped // ${found.map((x) => x.name).join(', ')}`);
      break;
    }
    case 'ForgeTicket':
      moveSession(game, task.arg);
      break;
    // a service-account key opens one lock, quietly
    case 'ProbeIam': {
      const svc = keyLocks(h, toolLevel(game, 'IamProbe'))[0];
      if (svc) {
        svc.open = true;
        pushLine(s, `service-account key used // ${svc.name}:${svc.port} open`);
        h.logs.push({ minute: game.clock.minutes, ip, text: `service account ${svc.name}`, loud: false });
      }
      break;
    }
    // root opens every lock it reaches, and the incident responder always comes
    case 'EscalateKernel': {
      keyLocks(h, toolLevel(game, 'KernelPrivesc')).forEach((svc) => { svc.open = true; });
      s.alerted = true;
      s.trace = Math.min(s.trace + 0.15, 1);
      s.traceRate *= 2;
      pushLine(s, 'root // locks open // the incident responder is on its way');
      h.logs.push({ minute: game.clock.minutes, ip, text: 'privilege escalation', loud: true });
      break;
    }
    // a captured session token opens the service for a while
    case 'HijackSession': {
      const svc = h.services[task.arg];
      if (svc) {
        svc.open = true;
        svc.tokenLeft = TOKEN_SECS;
        pushLine(s, `session token captured // ${svc.name}:${svc.port} // good for ${TOKEN_SECS}s`);
        h.logs.push({ minute: game.clock.minutes, ip, text: `session replay ${svc.name}`, loud: false });
      }
      break;
    }
    case 'CrackPassword': {
      const svc = h.services[task.arg];
      if (svc) {
        svc.open = true;
        pushLine(s, `open // ${svc.name}:${svc.port}`);
        h.logs.push({ minute: game.clock.minutes, ip, text: `brute force ${svc.name}`, loud: true });
      }
      break;
    }
    case 'CopyFile': {
      const f = h.files[task.arg];
      if (f && !f.deleted) {
        game.player.storage.push({ name: f.name, size: f.size, tag: f.tag, enc: f.enc, source: h.name });
        game.stats.filesStolen += 1;
        f.copied = true;
        if (traitOf(h) === 'honeypot') {
          s.alerted = true;
          s.trace = Math.min(s.trace + 0.1, 1);
          pushLine(s, 'honeypot // the copy tripped an alarm');
        }
        pushLine(s, `copied // ${f.name}`);
        h.logs.push({ minute: game.clock.minutes, ip, text: `download ${f.name}`, loud: true });
      }
      break;
    }
    case 'DeleteFile': {
      const f = h.files[task.arg];
      if (f) {
        f.deleted = true;
        pushLine(s, `destroyed // ${f.name}`);
        h.logs.push({ minute: game.clock.minutes, ip, text: `delete ${f.name}`, loud: true });
      }
      break;
    }
    case 'DecryptFile': {
      const f = h.files[task.arg];
      if (f) {
        f.enc = 0;
        f.decrypted = true;
        pushLine(s, `decrypted // ${f.name}`);
        h.logs.push({ minute: game.clock.minutes, ip, text: `decrypt ${f.name}`, loud: true });
      }
      break;
    }
    case 'OsintSweep': {
      // the public footprint names the company's other machines
      const co = game.world.companies[h.company];
      const found = (co?.hosts ?? []).filter((id) => !game.world.hosts[id].discovered);
      found.forEach((id) => discover(game, id));
      const leads = co ? addLeads(game, h.company) : 0;
      pushLine(s, `osint sweep // ${found.length} more hosts of ${co?.name ?? 'no company'} on the map // ${leads} new leads in DOSSIERS`);
      break;
    }
    case 'ModifyLogs': {
      const n = h.logs.filter((l) => l.ip === ip).length;
      h.logs = h.logs.filter((l) => l.ip !== ip);
      game.stats.logsWiped += n;
      pushLine(s, `own logs scrubbed // ${n} entries`);
      break;
    }
    case 'AlterRecord': {
      const { person, field, value } = task.arg;
      const p = game.world.people[person];
      if (p) {
        p[field] = value;
        pushLine(s, `record altered // ${p.name} // ${field} ${value}`);
        h.logs.push({ minute: game.clock.minutes, ip, text: `alter record ${p.ssn}`, loud: true });
      }
      break;
    }
    case 'Profile': {
      const p = game.world.people[task.arg];
      const it = intelOf(game, task.arg);
      it.level = Math.max(it.level, Math.min(toolLevel(game, 'OsintSweep'), 4));
      const found = INTEL_FIELDS.filter((f) => f.level <= it.level).map((f) => f.label.toLowerCase());
      pushLine(s, `profiled // ${p.name} // ${found.join(', ')}`);
      break;
    }
    case 'CallRecord':
    case 'SpoofCall': {
      const p = game.world.people[task.arg];
      game.player.storage.push({ name: sampleName(p), size: 1, tag: 'voice', enc: 0, source: h.name, person: task.arg });
      pushLine(s, `recorded // ${p.name} // ${sampleName(p)}`);
      // a spoofed call shows as the company's own IT desk: nothing to trace
      if (task.kind === 'CallRecord') h.logs.push({ minute: game.clock.minutes, ip, text: `call to ${p.name}`, loud: false });
      break;
    }
    case 'TapPhone': {
      const p = game.world.people[task.arg];
      intelOf(game, task.arg).tapped = true;
      const opened = useAccess(game, task.arg);
      h.logs.push({ minute: game.clock.minutes, ip, text: `line ${p.ssn.slice(-4)} diverted`, loud: true });
      pushLine(s, `tapped // ${p.name}`);
      pushMail(game, {
        id: 0, from: 'FAKE IDENTITY KIT <tap@spoof.kit>', subject: `TAP LIVE // ${p.name}`,
        body: `You are listening to ${p.name}'s calls.

${opened ? `They read a password out to the help desk: it opened ${opened}.` : 'Nothing they said opens anything their clearance reaches.'}`,
        minute: game.clock.minutes, read: false,
      });
      break;
    }
    case 'HackInbox': {
      const p = game.world.people[task.arg];
      intelOf(game, task.arg).inbox = true;
      const leads = addLeads(game, p.company);
      const co = game.world.companies[p.company];
      (co?.hosts ?? []).forEach((id) => discover(game, id));
      // a clearance of 3 or more keeps passwords in the mailbox
      const opened = p.clearance >= 3 ? useAccess(game, task.arg) : null;
      h.logs.push({ minute: game.clock.minutes, ip, text: `mailbox login ${p.email}`, loud: true });
      pushLine(s, `inbox open // ${p.email}`);
      pushMail(game, {
        id: 0, from: `${p.name} <${p.email}>`, subject: `INTERCEPTED // ${p.name}'s inbox`,
        body: `A copy of ${p.name}'s mail.

It names every host of ${co?.name ?? 'the company'} (now on your map) and ${leads} colleagues (now leads in DOSSIERS).
${opened ? `A saved password in it opened ${opened}.` : p.clearance >= 3 ? 'Its passwords open nothing still locked.' : 'Their clearance is too low to keep passwords worth having.'}`,
        minute: game.clock.minutes, read: false,
      });
      break;
    }
    case 'Phish': {
      const p = game.world.people[task.arg];
      const it = intelOf(game, task.arg);
      it.phishAt = game.clock.minutes + PHISH_MINUTES;
      it.phishTaken = phishTaken(p, task.arg, game.clock.minutes);
      pushLine(s, `phish sent // ${p.email} // answer in ${PHISH_MINUTES / 60}h`);
      break;
    }
    case 'Spam': {
      const p = game.world.people[task.arg];
      intelOf(game, task.arg).spamUntil = game.clock.minutes + SPAM_MINUTES;
      pushLine(s, `spammed // ${p.email} // buried for a day`);
      break;
    }
    case 'RecordVoice': {
      const who = voiceAdmin(game, h);
      const p = game.world.people[who];
      if (p) {
        game.player.storage.push({ name: sampleName(p), size: 1, tag: 'voice', enc: 0, source: h.name, person: who });
        pushLine(s, `recorded // ${p.name} // ${sampleName(p)}`);
        h.logs.push({ minute: game.clock.minutes, ip, text: `call to ${p.name}`, loud: false });
      }
      break;
    }
    case 'PlayVoiceprint': {
      const svc = h.services[task.arg];
      if (svc) {
        svc.open = true;
        pushLine(s, `voiceprint accepted // ${svc.name}:${svc.port}`);
        h.logs.push({ minute: game.clock.minutes, ip, text: `voice auth ${svc.name}`, loud: false });
      }
      break;
    }
    case 'WipeLogs': {
      const n = h.logs.length;
      h.logs = [];
      game.stats.logsWiped += n;
      pushLine(s, `logs wiped // ${n} entries`);
      break;
    }
    default:
      break;
  }
  evaluateMissions(game);
}
