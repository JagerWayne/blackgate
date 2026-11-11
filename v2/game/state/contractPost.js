// The reward, the brief and the posting of a job.

import { range, pick, nextF32 } from '../core/rng.js';
import { briefs, clients, missionFor } from '../data/content.js';
import { MISSION_LABEL } from '../data/enums.js';
import { newId, pushMail, host, discover } from './gameHelpers.js';

/// The reward the built-in kinds pay.
export const REWARD = {
  retrieve: 450, delete: 380, modify: 700, transfer: 900, destroy: 2600, model: 3200, story: 0,
};

/// What a job of a kind pays before the random swing: the kind's base plus the
/// difficulty's share, grown by the operator's standing (x2 at rating 100).
export function baseReward(kind, difficulty, rating = 0) {
  return (REWARD[kind] + difficulty * rewardScale(kind)) * (1 + Math.min(rating, 100) / 100);
}

/// Works out the pay, writes the brief and puts the job on the board.
export function postContract(game, spec) {
  const { kind, target, co, hostName, subject, amount, difficulty, story, rating } = spec;
  // pay rises with the operator's standing as well as with the target: x2 at rating 100
  let reward = baseReward(kind, difficulty, rating ?? 0);
  reward = Math.floor(reward * (0.85 + nextF32(game.rng) * 0.4));
  const drawn = game.clock.minutes + 1440 + range(game.rng, 0, 2880);
  const deadline = spec.hours ? game.clock.minutes + spec.hours * 60 : drawn;

  const template = story ? null : missionFor(kind, rating, nextF32(game.rng), range(game.rng, 0, 64));
  if (template) reward = Math.floor(reward * Math.max(template.reward_mult ?? 1, 0));
  if (spec.reward) reward = spec.reward;
  const pool = template ? template.brief : briefs(kind);
  // a custom brief has its placeholders filled like any other
  let brief = spec.brief || pool.length
    ? fillBrief(spec.brief || pick(game.rng, pool), subject, hostName, co, amount)
    : 'Directive follows.';
  const client = spec.client ? spec.client : story
    ? 'WARDEN'
    : template && template.client
      ? template.client
      : clients().length
        ? pick(game.rng, clients())
        : 'PRIVATE CLIENT';

  // the job names its change, whichever brief was drawn

  if (spec.record) brief = `${brief}

CHANGE   ${subject}`;

  const id = newId(game);
  // the offer names the machine and gives its address: it is on the map from
  // the moment the job is posted, so the work can always be reached
  discover(game, target);
  game.contracts.push({
    id,
    client,
    kind,
    target,
    file: spec.fileName ?? null,
    subject,
    amount,
    reward,
    posted: game.clock.minutes,
    deadline,
    difficulty,
    state: 'offered',
    brief,
    story,
    title: template ? template.title ?? '' : '',
    record: spec.record ?? null,
  });
  if (spec.fileName) {
    const f = host(game, target).files.find((x) => x.name === spec.fileName);
    if (f) f.tag = id;
  }
  if (!story) {
    pushMail(game, {
      id: 0,
      from: `${client} <broker@blackgate.onion>`,
      subject: `CONTRACT ${id} // ${MISSION_LABEL[kind]}`,
      body: `${brief}\n\nTARGET   ${co}\nHOST     ${hostName}\nWINDOW   ${Math.floor((deadline - game.clock.minutes) / 60)} hours\nFEE      ${reward} cr\n\nListed on DSNET at dsn://job/${id}: talk the fee up or accept it there.`,
      minute: game.clock.minutes,
      read: false,
      contract: id,
      kind: 'contract',
      attachment: null,
    });
  }
  return id;
}

/// The extra pay the difficulty adds.
function rewardScale(kind) {
  switch (kind) {
    case 'retrieve': return 240;
    case 'delete': return 190;
    case 'modify': return 300;
    case 'transfer': return 380;
    case 'destroy': return 520;
    case 'model': return 640;
    default: return 0;
  }
}

/// Fills the placeholders in a brief.
export function fillBrief(line, subject, hostName, co, amount) {
  // the braces stay around each value, so the brief can show it highlighted
  return line
    .replace('{file}', `{${subject}}`)
    .replace('{subject}', `{${subject}}`)
    .replace('{host}', `{${hostName}}`)
    .replace('{co}', `{${co}}`)
    .replace('{amount}', `{${amount}}`);
}
