// The clock: the world moves a minute at a time, and the minute does the
// work: contracts expire, the board refills, the wire runs.

import { advance, SECONDS_PER_MINUTE } from '../core/clock.js';
import { spawnContract } from '../state/contractSpawn.js';
import { note, toast, randomHeadline } from '../state/gameState.js';
import { timeScale } from '../state/cheats.js';
import { haggleTick } from '../state/haggle.js';

/// Advances the clock and does the per-minute work.
export function clockTick(game, dt) {
  const speed = timeScale(game);
  const minutes = (dt * speed) / SECONDS_PER_MINUTE;
  game.carry += minutes;
  const whole = Math.floor(game.carry);
  if (whole >= 1) {
    game.carry -= whole;
    advance(game.clock, whole);
    onMinutes(game, whole);
  }
}

/// How many finished jobs the history keeps.
const HISTORY = 40;

/// Keeps the history to its last few jobs, so a long run does not grow the
/// save without end. Live jobs are never touched.
function pruneHistory(game) {
  const done = game.contracts.filter((c) => ['done', 'failed', 'expired'].includes(c.state));
  if (done.length <= HISTORY) return;
  const drop = new Set(done.slice(0, done.length - HISTORY).map((c) => c.id));
  game.contracts = game.contracts.filter((c) => !drop.has(c.id));
}

/// The work that happens when a minute passes.
export function onMinutes(game, minutes) {
  const now = game.clock.minutes;

  // the contracts that ran out of time
  game.contracts
    .filter((c) => (c.state === 'accepted' || c.state === 'ready') && now > c.deadline)
    .forEach((c) => {
      c.state = 'failed';
      game.player.rating = Math.max(game.player.rating - 1, 0);
      game.stats.missionsFailed += 1;
      note(game, `contract ${c.id} failed // deadline`);
      toast(game, 'Contract expired', 'bad');
    });

  // an offer whose window has closed can no longer be done: it is withdrawn
  // to the history, and the operator is told
  game.contracts
    .filter((c) => c.state === 'offered' && now > c.deadline)
    .forEach((c) => {
      c.state = 'expired';
      note(game, `offer ${c.id} withdrawn // window closed`);
      toast(game, `Offer #${c.id} withdrawn // its window closed`, 'info');
    });
  pruneHistory(game);

  // the board is restocked, and each new job is announced
  let guard = 0;
  haggleTick(game);
  while (game.contracts.filter((c) => c.state === 'offered').length < offerCap(game) && guard < 12) {
    const id = spawnContract(game, false);
    if (id === null) break;
    const c = game.contracts.find((x) => x.id === id);
    toast(game, `New listing #${id} // ${c?.reward ?? 0} cr // on DSNET`, 'money');
    guard += 1;
  }

  // the wire keeps running
  // a batch of minutes may step over a multiple of 97
  if (Math.floor(now / 97) !== Math.floor((now - minutes) / 97)) {
    const [headline, body] = randomHeadline(game);
    game.news.push({ minute: now, headline, body });
    if (game.news.length > 40) game.news.shift();
  }
}

/// How many open offers the board keeps: six, and one more for every 30
/// rating, up to ten.
export function offerCap(game) {
  return Math.min(6 + Math.floor((game.player.rating ?? 0) / 30), 10);
}
