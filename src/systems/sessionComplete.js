// What a finished task did to the world.

import { pushLine } from '../state/session.js';
import { evaluateMissions } from '../state/contracts.js';
import { discover } from '../state/gameState.js';

/// The task finished: the world changes.
export function completeTask(game, s, task) {
  const h = game.world.hosts[s.target];
  const ip = game.player.gateway.ip;
  switch (task.kind) {
    case 'BypassFirewall':
      s.fwBypassed = true;
      pushLine(s, 'firewall bypassed');
      break;
    case 'BypassMonitor':
      s.monBypassed = true;
      pushLine(s, 'monitor blinded // trace starved');
      break;
    case 'BypassProxy':
      s.proxyBypassed = true;
      h.services.filter((v) => v.kind === 'proxy').forEach((v) => { v.open = true; });
      s.traceRate *= 0.65;
      pushLine(s, 'proxy chain scrubbed // trace slowed');
      break;
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
      if (f) {
        game.player.storage.push({ name: f.name, size: f.size, tag: f.tag, enc: f.enc, source: h.name });
        game.stats.filesStolen += 1;
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
      pushLine(s, `osint sweep // ${found.length} more hosts of ${co?.name ?? 'no company'} on the map`);
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
