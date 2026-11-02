// The contract board: taking work, doing it and being paid.

import { MISSION_LABEL, RATING_MAX } from '../data/enums.js';
import { note, pushMail, pay } from './gameHelpers.js';

/// Takes a job.
export function acceptContract(game, id) {
  const c = game.contracts.find((x) => x.id === id);
  if (!c || c.state !== 'offered') return false;
  if (game.contracts.filter((x) => x.state === 'accepted' || x.state === 'ready').length >= 4) return false;
  c.state = 'accepted';
  note(game, `contract ${id} accepted`);
  evaluateMissions(game); // the work may already be done
  return true;
}

/// Turns a job down.
export function declineContract(game, id) {
  const c = game.contracts.find((x) => x.id === id);
  if (!c || c.state !== 'offered') return false;
  c.state = 'expired';
  note(game, `contract ${id} declined`);
  return true;
}

/// Drops a job that was taken.
export function dropContract(game, id) {
  const c = game.contracts.find((x) => x.id === id);
  if (!c || (c.state !== 'accepted' && c.state !== 'ready')) return false;
  c.state = 'failed';
  note(game, `contract ${id} dropped`);
  return true;
}

/// Hands the finished work in.
export function submitContract(game, id) {
  const c = game.contracts.find((x) => x.id === id);
  if (!c || c.state !== 'ready') return 'the work is not finished';
  c.state = 'done';
  game.stats.missionsDone += 1;
  game.player.rating = Math.min(game.player.rating + 1, RATING_MAX);
  pay(game, c.reward, `contract ${id}`);
  note(game, `contract ${id} delivered // ${c.reward} cr`);
  game.toasts.push({ text: `+${c.reward} cr // contract complete`, kind: 'money', born: game.uiTime });
  pushMail(game, {
    id: 0,
    from: `${c.client} <broker@blackgate.onion>`,
    subject: `PAID // ${contractLabel(c)}`,
    body: `Work on ${c.subject} accepted. ${c.reward} cr cleared into your account.`,
    minute: game.clock.minutes,
    read: false,
    contract: c.id,
    kind: 'system',
    attachment: null,
  });
  return null;
}

/// The contracts a CONTRACTS tab lists, soonest deadline first: 0 is the
/// offers, 1 the jobs taken, 2 the history.
export function contractItems(game, tab) {
  return game.contracts
    .filter((c) => {
      if (tab === 0) return c.state === 'offered';
      if (tab === 1) return c.state === 'accepted' || c.state === 'ready';
      return ['done', 'failed', 'expired'].includes(c.state);
    })
    .sort((a, b) => a.deadline - b.deadline);
}

/// The name a job posts under.
export function contractLabel(c) {
  return c.title || MISSION_LABEL[c.kind] || 'WORK';
}

/// Marks the accepted work that is now finished.
export function evaluateMissions(game) {
  game.contracts.forEach((c) => {
    if (c.state !== 'accepted') return;
    const h = game.world.hosts[c.target];
    let ok = false;
    if (c.kind === 'retrieve' || c.kind === 'model') {
      ok = game.player.storage.some((f) => f.name === c.file && f.tag === c.id);
    } else if (c.kind === 'delete') {
      ok = h.files.every((f) => f.deleted || f.name !== c.file);
    } else if (c.kind === 'destroy') {
      ok = h.files.every((f) => f.deleted) && h.logs.length === 0;
    } else if (c.kind === 'modify') {
      const r = c.record;
      ok = !!r && game.world.people[r.person]?.[r.field] === r.value;
    } else if (c.kind === 'transfer') {
      ok = !!game.story.flags[`transfer.${c.id}`];
    } else if (c.kind === 'story') {
      ok = !!game.story.flags[`story.${c.id}`];
    }
    if (ok) {
      c.state = 'ready';
      note(game, `objective complete // ${c.id} // ${c.kind}`);
      game.toasts.push({ text: `Objective complete // ${c.id}`, kind: 'good', born: game.uiTime });
    }
  });
}
