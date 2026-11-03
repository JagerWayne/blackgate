// The contents of a host: the services it runs and the files it keeps.

import { range, chance } from '../core/rng.js';
import { fileStems, fileExtensions } from './content.js';
import { CO_LABEL } from './enums.js';
import { assignAuth } from './auth.js';

/// Fills a host with its services and its files.
export function buildHostContent(rng, host, kind, role, wealth) {
  const adminPw = Math.min(1 + range(rng, 0, 4), 5);
  host.services.push({ name: 'http', port: 80, kind: 'web', password: 0, open: true, visible: true });
  host.services.push({ name: 'smtp', port: 25, kind: 'mail', password: 0, open: true, visible: true });
  if (role === 'mail' || kind === 'gov') {
    host.services.push({ name: 'imap', port: 143, kind: 'mail', password: Math.min(adminPw, 3), open: false, visible: true });
  }
  host.services.push({ name: 'admin', port: 22, kind: 'admin', password: adminPw, open: false, visible: true });
  host.services.push({ name: 'records', port: 8443, kind: 'records', password: Math.min(adminPw + 1, 5), open: false, visible: true });
  if (kind === 'bank') {
    host.services.push({ name: 'banking', port: 443, kind: 'bank', password: Math.min(adminPw + 1, 5), open: false, visible: true });
    host.services.push({ name: 'voice', port: 5060, kind: 'voice', password: 2, open: false, visible: true });
  } else if (kind === 'aiLab') {
    host.services.push({ name: 'training', port: 9000, kind: 'ai', password: Math.min(adminPw + 1, 5), open: false, visible: true });
    host.services.push({ name: 'database', port: 5432, kind: 'db', password: adminPw, open: false, visible: true });
  } else if (kind === 'gov') {
    host.services.push({ name: 'citizen', port: 8080, kind: 'records', password: Math.min(adminPw + 1, 5), open: false, visible: true });
    host.services.push({ name: 'voice', port: 5060, kind: 'voice', password: 3, open: false, visible: true });
  } else {
    host.services.push({ name: 'database', port: 5432, kind: 'db', password: adminPw, open: false, visible: true });
  }

  // the cracker stops at v3 and the voice cloner at v1: no lock asks for more
  host.services.forEach((v) => { v.password = v.kind === 'voice' ? 1 : Math.min(v.password, 3); });

  const nFiles = 3 + range(rng, 0, 4) + wealth;
  for (let i = 0; i < nFiles; i += 1) {
    const stems = fileStems();
    const stem = stems[(i * 3 + range(rng, 0, 20)) % stems.length];
    const exts = fileExtensions();
    const ext = exts[range(rng, 0, exts.length)];
    // the sizes are in the scale of the gateway's memory pools: a tier one
    // module holds a couple of these, a tier five array holds dozens
    const size = range(rng, 2, 26) + wealth * 5;
    let enc = 0;
    if (kind === 'bank' || kind === 'gov') {
      enc = chance(rng, 0.35) ? 1 + range(rng, 0, 2) : 0;
    } else if (chance(rng, 0.15)) {
      enc = 1;
    }
    // the harder the host, the harder its encryption: the decrypter has seven versions
    if (enc > 0) enc = Math.min(enc + host.firewall, 7);
    host.files.push({
      name: `${stem}_${range(rng, 10, 99)}.${ext}`,
      size,
      enc,
      tag: 0,
      content: `${stem.toUpperCase()} // ${CO_LABEL[kind] ?? 'FIRM'} // ${role.toUpperCase()}`,
      deleted: false,
    });
  }

  // a hard host also keeps a datastore dump, too big for a slow line to take inside its
  // time window (no random draws, so a world's other contents do not move)
  if (host.firewall + host.monitor + host.proxy >= 6) {
    const total = host.files.reduce((n, f) => n + f.size, 0);
    const stems = fileStems();
    const exts = fileExtensions();
    host.files.push({
      name: `${stems[total % stems.length]}_dump_${10 + (total % 90)}.${exts[total % exts.length]}`,
      size: Math.min(Math.max(total * 3, 150), 450),
      enc: 0,
      tag: 0,
      content: `DATASTORE DUMP // ${CO_LABEL[kind] ?? 'FIRM'} // ${role.toUpperCase()}`,
      deleted: false,
    });
  }

  // a couple of old access logs, so covering your tracks works from minute one
  const nLogs = 2 + range(rng, 0, 3);
  for (let i = 0; i < nLogs; i += 1) {
    host.logs.push({
      minute: i * 37,
      ip: `${40 + range(rng, 0, 120)}.${range(rng, 0, 255)}.${range(rng, 0, 255)}.${1 + range(rng, 0, 254)}`,
      text: 'session open',
      loud: false,
    });
  }

  // the locks of a hard host are behind MFA or a hardware token
  assignAuth(host);
}
