// The undernet board: the day's threads, replies, the player's own posts and paid tips. Everything is worked out from the
// seed, the day and the clock, so no random draw is spent; what the player does is kept on game.board.

import { darknet } from '../data/content.js';
import { seedHash, staffOf } from './sites.js';
import { hostRoles } from './siteInfo.js';
import { learn } from './intel.js';
import { charge, toast } from './gameHelpers.js';
import { t as tl } from '../data/language.js';

export const TIP_PRICE = 120;
const MAX_MINE = 5;
const REPLIES = ['same here', 'source?', 'you did not hear it from me', 'careful, this thread is watched', 'check the archive', 'pastedump had the same name yesterday', 'prove it', 'lol, ok', 'delete this', 'i would not touch that box'];

const day = (game) => Math.floor(game.clock.minutes / 1440);
const state = (game) => (game.board ??= { mine: [], tips: {} });

/// An anonymous handle, the same for the same words.
export const anon = (game, ...parts) => `anon_${1000 + (seedHash(game, 'anon', ...parts) % 9000)}`;

/// The day's threads: { text, ci, name }, eight of them.
export function feedOf(game) {
  const d = darknet();
  const d0 = day(game);
  const names = Object.keys(d.brokers);
  const cos = game.world.companies;
  const headline = game.news.at(-1)?.headline ?? 'nothing happened';
  const posts = d.forum.map((t, i) => {
    const k = d0 * 7 + i * 13;
    const ci = k % cos.length;
    const roles = hostRoles(game, ci);
    return { text: t.replace('{client}', names[k % names.length]).replace('{co}', cos[ci]?.name ?? 'someone').replace('{role}', roles[k % (roles.length || 1)] ?? 'old').replace('{headline}', headline), ci, name: anon(game, d0, i) };
  });
  return posts.map((p, i) => [p, (d0 * 31 + i * 17) % posts.length]).sort((a, b) => a[1] - b[1]).slice(0, 8).map(([p]) => p);
}

/// Replies under a thread or one of the player's posts: how many have come in, and what they say.
export function repliesOf(game, key, count) {
  return Array.from({ length: count }, (_, k) => ({ who: anon(game, key, k), text: REPLIES[seedHash(game, 'reply', key, k) % REPLIES.length] }));
}

/// The player's own posts, newest first, each with the replies that have arrived (one every twenty game minutes, three at most).
export function minePosts(game) {
  return [...state(game).mine].reverse().map((p) => ({ ...p, replies: repliesOf(game, `mine${p.minute}`, Math.min(3, Math.floor((game.clock.minutes - p.minute) / 20))) }));
}

/// Posts to the board. Anyone can read it, so it adds a little heat. Returns whether it posted.
export function postThread(game, text) {
  const t = String(text ?? '').trim();
  if (t.length < 3) { toast(game, tl('state.board.say_something_first'), 'bad'); return false; }
  const b = state(game);
  b.mine.push({ text: t.slice(0, 140), minute: Math.floor(game.clock.minutes) });
  if (b.mine.length > MAX_MINE) b.mine.shift();
  game.player.heat = Math.min(100, game.player.heat + 2);
  toast(game, tl('state.board.posted_people_are_reading'), 'info');
  return true;
}

/// The tip bought on a thread today, or null.
export const tipOf = (game, i) => state(game).tips[`${day(game)}:${i}`] ?? null;

/// Pays a poster for what they know about the company in a thread. Three tips in four are true: they put a staff member's
/// email on file and name a server the company shows. The fourth is a fraud and the money is gone.
export function buyTip(game, i) {
  const post = feedOf(game)[i];
  if (!post) return false;
  const key = `${day(game)}:${i}`;
  const b = state(game);
  if (b.tips[key]) { toast(game, tl('state.board.you_already_bought_this'), 'info'); return false; }
  if (!charge(game, TIP_PRICE, `tip on the board: ${post.name}`)) { toast(game, tl('state.board.a_tip_costs_cr', TIP_PRICE), 'bad'); return false; }
  const staff = staffOf(game, post.ci);
  const hosts = game.world.companies[post.ci].hosts.map((id) => game.world.hosts[id]).filter((h) => !h.internal);
  if (seedHash(game, 'tip', key) % 4 === 0 || !staff.length || !hosts.length) {
    b.tips[key] = { ok: false, text: `${post.name} took the money and went quiet` };
    toast(game, tl('state.board.the_tip_was_a'), 'bad');
    return true;
  }
  const who = staff[seedHash(game, 'tip-who', key) % staff.length];
  const host = hosts[seedHash(game, 'tip-host', key) % hosts.length];
  learn(game, who, 'email');
  b.tips[key] = { ok: true, text: `${post.name}: ask ${game.world.people[who].email}, and the box to look at is ${host.domain}` };
  toast(game, tl('state.board.the_tip_checks_out'), 'good');
  return true;
}
