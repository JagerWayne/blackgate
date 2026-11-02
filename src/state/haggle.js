// Haggling on DeepSpaceN3T: the operator asks a client for a bigger fee. The
// client answers a few minutes later: yes, a counter-offer halfway, or no.
// Asking for more than double is an insult: the listing is pulled and the
// client will not deal for a day. One ask per job.

import { RATING_MAX } from '../data/enums.js';
import { darknet } from '../data/content.js';
import { acceptContract } from './contracts.js';
import { note, toast } from './gameState.js';

/// The most a client will hear asked: above this the listing is pulled.
export const INSULT = 2;
/// How long an insulted client refuses to deal, in game minutes.
export const SNUB_MINUTES = 24 * 60;
const STEEP = 1.78;

/// A broker's site details, or a plain one for a client without a page.
export function broker(client) {
  const b = darknet()?.brokers?.[client];
  if (b) return b;
  const slug = client.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'anon';
  return { domain: `${slug}.dsn`, tagline: 'a client of few words.', temper: 1, accent: '#abb2bf', banner: [client], about: 'No page of their own: they post through the hub.' };
}

/// The haggle state of a job, or null before any ask.
export function haggleOf(game, id) {
  return game.haggle?.[id] ?? null;
}

/// Whether a client refuses to deal right now.
export function snubbed(game, client) {
  return (game.snubs?.[client] ?? -1) > game.clock.minutes;
}

/// The chance a client says yes to an ask: falls with the size of the ask,
/// rises with the operator's rating, and the client's temper bends it.
export function haggleOdds(game, c, ask) {
  const over = Math.max(ask / c.reward - 1, 0);
  if (ask / c.reward > INSULT) return 0;
  const skill = 0.5 + game.player.rating / RATING_MAX;
  return Math.min(Math.exp(-over * STEEP * broker(c.client).temper / skill), 0.97);
}

/// A fixed roll for a job and an ask: the same ask always gets the same answer.
function roll(id, ask) {
  let h = 2166136261 ^ id;
  h = Math.imul(h ^ Math.round(ask), 16777619) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 2246822519) >>> 0;
  return (h % 10000) / 10000;
}

/// Sends an ask. Returns an error, or null when the client is thinking it over.
export function askFee(game, id, ask) {
  const c = game.contracts.find((x) => x.id === id);
  if (!c || c.state !== 'offered') return 'that listing is not open';
  if (snubbed(game, c.client)) return `${c.client} is not taking your calls`;
  if (haggleOf(game, id)) return 'you have already made your ask on this job';
  ask = Math.round(ask);
  if (!(ask > c.reward)) return `ask for more than ${c.reward} cr`;
  const minute = game.clock.minutes;
  game.haggle ??= {};
  game.haggle[id] = {
    ask,
    was: c.reward,
    state: 'waiting',
    replyAt: minute + 5 + (id % 11),
    log: [{ who: 'you', text: `I'll do it for ${ask} cr.`, minute }],
  };
  return null;
}

/// Takes a counter-offer, or the posted fee. Returns an error or null.
export function takeOffer(game, id) {
  const c = game.contracts.find((x) => x.id === id);
  const hg = haggleOf(game, id);
  if (!c || c.state !== 'offered') return 'that listing is not open';
  if (hg?.state === 'counter') {
    c.reward = hg.counter;
    hg.state = 'yes';
    hg.log.push({ who: 'you', text: `Deal at ${hg.counter} cr.`, minute: game.clock.minutes });
  }
  return acceptContract(game, id) ? null : 'your job slots are full // finish or drop one first';
}

/// The clients answer the asks whose time has come. Called with the clock.
export function haggleTick(game) {
  if (!game.haggle) return;
  const now = game.clock.minutes;
  Object.entries(game.haggle).forEach(([key, hg]) => {
    if (hg.state !== 'waiting' || hg.replyAt > now) return;
    const id = Number(key);
    const c = game.contracts.find((x) => x.id === id);
    if (!c || c.state !== 'offered') {
      hg.state = 'gone';
      return;
    }
    const say = (text) => hg.log.push({ who: c.client, text, minute: now });
    if (hg.ask / hg.was > INSULT) {
      hg.state = 'snub';
      c.state = 'expired';
      game.snubs ??= {};
      game.snubs[c.client] = now + SNUB_MINUTES;
      say('Double? Listing withdrawn. Do not contact us again today.');
      note(game, `${c.client} pulled offer ${id} // the ask was an insult`);
      toast(game, `${c.client} pulled the listing`, 'bad');
      return;
    }
    const p = haggleOdds(game, c, hg.ask);
    const r = roll(id, hg.ask);
    if (r < p) {
      hg.state = 'yes';
      c.reward = hg.ask;
      say(`Fine. ${hg.ask} cr. Do not make us regret it.`);
      toast(game, `${c.client} agreed to ${hg.ask} cr`, 'money');
    } else if (r < p + 0.3) {
      hg.state = 'counter';
      hg.counter = Math.round((hg.was + hg.ask) / 2);
      say(`Too rich. We can meet you at ${hg.counter} cr. Take it or leave it.`);
      toast(game, `${c.client} countered at ${hg.counter} cr`, 'info');
    } else {
      hg.state = 'no';
      say(`No. The fee is ${hg.was} cr. It was always ${hg.was} cr.`);
      toast(game, `${c.client} refused your ask`, 'bad');
    }
  });
}
