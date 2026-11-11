// The new run: the player, the account and the world behind it.

import { startingCash, startingRating } from '../data/settings.js';
import { makeRng, range } from '../core/rng.js';
import { makeClock } from '../core/clock.js';
import { generateWorld } from '../data/world.js';
import { makeGateway, starterParts } from './gateway.js';
import { STARTER_TOOLS } from '../data/enums.js';
import { seedWorld } from './seed.js';
import { kitCost } from './tutorial.js';

/// The shape of a saved run. A save of any other version is turned away.
export const SAVE_VERSION = 4;

/// Builds a new run.
/// `bare` is a real new run: an empty gateway and the cash to equip it, which
/// the tutorial walks through. Without it the run starts with the old basic tools.
export function makeGame(handle, seed, { bare = false } = {}) {
  const rng = makeRng(BigInt(seed) ^ 0x123456789abcdef0n);
  const world = generateWorld(seed);
  const gw = makeGateway();
  gw.ip = `172.${range(rng, 16, 31)}.${range(rng, 0, 255)}.${range(rng, 2, 254)}`;
  gw.parts = starterParts();

  const bank = world.companies.findIndex((c) => c.kind === 'bank');
  const bankCompany = world.companies[bank >= 0 ? bank : 0];
  // a bare run gets the price of the basic tools on top, so it is left with 4,000 once they are bought
  const cash = startingCash() + (bare ? kitCost() : 0);
  const account = {
    host: bankCompany.hosts[0],
    number: `NX00${range(rng, 100000, 999999)}`,
    owner: handle,
    balance: cash,
    bank: bankCompany.name,
    player: true,
  };

  const game = {
    version: SAVE_VERSION,
    seed,
    rng,
    clock: makeClock(0),
    player: {
      handle,
      rating: startingRating(),
      credits: cash,
      gateway: gw,
      tools: bare ? [] : STARTER_TOOLS.map((kind) => ({ kind, level: 1 })),
      bounce: [],
      heat: 0,
      storage: [],
      accounts: [account],
      flags: {},
      stock: [],
      build: null,
      introDone: false,
    },
    world,
    contracts: [],
    mail: [],
    news: [],
    rivals: [],
    story: { act: 0, faction: 0, flags: {} },
    session: null,
    nextId: 1,
    settings: { sound: true, effects: true, autosave: true, fastForward: false, timeScale: 1 },
    cheats: { freezeHeat: null, freezeTrace: false },
    perks: [],
    stats: {
      missionsDone: 0, missionsFailed: 0, hostsBreached: 0, filesStolen: 0,
      earned: 0, tracesEscaped: 0, ghostRuns: 0, logsWiped: 0,
    },
    log: [],
    paused: false,
    gameOver: null,
    carry: 0,
    favorites: [],
    routes: [],
    ledger: [],
    notes: '',
    toasts: [],
    uiTime: 0,
  };
  world.accounts.push({ ...account });
  world.hosts.forEach((h) => {
    if (h.relay) h.discovered = true;
  });
  for (let i = 0; i < 6; i += 1) {
    const c = world.companies[i];
    if (c && c.hosts.length) world.hosts[c.hosts[0]].discovered = true;
  }
  seedWorld(game, bare);
  return game;
}
