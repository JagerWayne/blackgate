// The seeding of a new run: the rivals, the first news, the first work and
// the broker's welcome.

import { range } from '../core/rng.js';
import { rivals, newsHeadlines, newsBodies } from '../data/content.js';
import { spawnContract } from './contractSpawn.js';
import { pushMail } from './gameHelpers.js';
import { welcomeBody } from './welcome.js';
import { startTutorial } from './tutorial.js';

/// Fills the world with the rivals, the news, the first work and a welcome.
export function seedWorld(game, bare = false) {
  const styles = ['quiet', 'loud', 'surgical', 'reckless', 'patient'];
  game.rivals = rivals().map((handle, i) => ({
    handle,
    rating: 12 + i * 9,
    style: styles[i % 5],
    lastMinute: 0,
  }));
  for (let i = 0; i < 8; i += 1) {
    const [headline, body] = randomHeadline(game);
    game.news.push({ minute: 0, headline, body });
  }
  for (let i = 0; i < 4; i += 1) spawnContract(game, false);
  pushMail(game, {
    id: 0,
    from: 'WARDEN <warden@blackgate.onion>',
    subject: 'WELCOME TO BLACKGATE',
    body: welcomeBody(game.player.handle, bare),
    minute: 0,
    read: false,
    contract: null,
    kind: 'normal',
    attachment: null,
  });
  startTutorial(game);
}

/// A headline and a body for the wire.
export function randomHeadline(game) {
  const co = game.world.companies.length
    ? game.world.companies[range(game.rng, 0, game.world.companies.length)].name
    : 'NEXUS';
  const heads = newsHeadlines();
  const bodies = newsBodies();
  const headline = heads[range(game.rng, 0, heads.length)].replace('{co}', co);
  const body = bodies[range(game.rng, 0, bodies.length)];
  return [headline, body];
}
