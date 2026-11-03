// The contract board: the work on offer. The spawn picks the kind and the
// target; `contractPost.js` works out the pay and puts the job up.

import { range, pick } from '../core/rng.js';
import { MISSION_KINDS } from '../data/enums.js';
import { companyName, host, hasTool } from './gameHelpers.js';
import { pickChange, recordText, keepsRecord, validRecord, RECORD_LABEL } from './records.js';
import { hint } from '../data/content.js';
import { pickTarget, freeSpace } from './contractTarget.js';
import { postContract } from './contractPost.js';

/// Puts a job on the board.
export function spawnContract(game, story = false, want = {}) {
  if (!game.world.hosts.length) return null;
  const rating = game.player.rating;
  // only the kinds the operator can finish: there is no task to alter a
  // record, to move credits or to take an encrypted model
  let kinds = ['retrieve', 'retrieve', 'delete'];
  const starter = game.stats.missionsDone === 0;
  if (starter) kinds = ['retrieve'];
  if (story) kinds = ['retrieve'];
  // sabotage burns every file and wipes the logs: it is only offered when the
  // operator carries the tools that can do both
  if (rating >= 20 && hasTool(game, 'FileDeleter') && hasTool(game, 'LogDeleter')) {
    kinds.push('destroy');
  }
  if (rating >= 8 && !starter && !story) kinds.push('modify');
  const kind = want.kind ?? pick(game.rng, kinds);

  // a job asked for by kind (the cheat menu) may go to any host that fits it
  const picked = pickTarget(game, kind, want.kind ? { only: want.target ?? null, anyGuard: true } : {});
  if (!picked) return null;
  const target = picked.target;
  const co = companyName(game, target);
  const hostName = host(game, target).name;
  const h = host(game, target);
  const difficulty = Math.min(Math.max(h.firewall + h.monitor + h.proxy, 1), 15);
  let fileName = null;
  let subject = '';
  let amount = 0;

  if (kind === 'retrieve' || kind === 'delete') {
    const idxs = jobFiles(game, h, kind);
    // a file asked for by name has to be one the job could name
    const named = want.file ? idxs.find((i) => h.files[i].name === want.file) : undefined;
    if (!idxs.length || (want.file && named === undefined)) return null;
    const fi = named ?? idxs[range(game.rng, 0, idxs.length)];
    fileName = h.files[fi].name;
    subject = fileName;
  }
  if (kind === 'destroy') subject = hint('destroyObjective');
  // an alteration changes one detail of one person, on a host that keeps it
  let record = null;
  if (kind === 'modify') {
    const r = want.record;
    // a change asked for has to be one this host can make
    if (r && (!keepsRecord(game, h, r.person, r.field) || !validRecord(game, r.field, r.value)
      || game.world.people[r.person][r.field] === r.value)) return null;
    record = r ?? pickChange(game, h);
    if (!record) return null;
    const p = game.world.people[record.person];
    subject = `${p.name} // ${RECORD_LABEL[record.field]} TO ${recordText(game, record.field, record.value)}`;
  }

  return postContract(game, {
    kind, target, co, hostName, subject, amount, difficulty, fileName, story, rating, record,
    reward: want.reward, hours: want.hours, client: want.client, brief: want.brief,
  });
}

/// The files a retrieve or delete job on a host could name: there and not
/// already on a job, and for a retrieve, plain and small enough for the drive.
export function jobFiles(game, h, kind) {
  const free = freeSpace(game);
  return h.files
    .map((f, i) => [f, i])
    .filter(([f]) => !f.deleted && f.tag === 0)
    .filter(([f]) => kind !== 'retrieve' || (f.enc === 0 && f.size <= free))
    .map(([, i]) => i);
}

/// Posts a job of a chosen kind, on a chosen host or a random one that fits
/// it, with its offer mail. Returns the job, or null when no host can take it.
/// The options: kind, target, file, record, reward, hours, client, brief, and
/// accept to take it straight away (past the four-job limit: it is a cheat).
export function generateCustomContract(game, { accept = false, ...want }) {
  const id = spawnContract(game, false, want);
  const c = id === null ? null : game.contracts.find((x) => x.id === id);
  if (c && accept) c.state = 'accepted';
  return c;
}

/// The kinds a job can be.
export { MISSION_KINDS };
