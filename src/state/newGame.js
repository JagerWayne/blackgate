// The new run: the player, the account and the world behind it.

import { makeRng, range } from '../core/rng.js';
import { makeClock } from '../core/clock.js';
import { generateWorld } from '../data/world.js';
import { makeGateway } from './gateway.js';
import { STARTER_TOOLS } from '../data/enums.js';
import { seedWorld } from './seed.js';

/// The shape of a saved run. A save of any other version is turned away.
export const SAVE_VERSION = 1;

/// Builds a new run.
export function makeGame(handle, seed) {
  const rng = makeRng(BigInt(seed) ^ 0x123456789abcdef0n);
  const world = generateWorld(seed);
  const gw = makeGateway();
  gw.ip = `172.${range(rng, 16, 31)}.${range(rng, 0, 255)}.${range(rng, 2, 254)}`;
  gw.parts = [
    { kind: 'cpu', level: 1, name: 'PHENOM-X 4-CORE' },
    { kind: 'ram', level: 1, name: '16 GB DDR4 SODIMM' },
    { kind: 'storage', level: 1, name: '32 GB 5400RPM DISK' },
    { kind: 'modem', level: 1, name: '100 Mbps DOCSIS MODEM' },
    { kind: 'security', level: 1, name: 'SURGE PROTECTOR + SENSOR' },
  ];

  const bank = world.companies.findIndex((c) => c.kind === 'bank');
  const bankCompany = world.companies[bank >= 0 ? bank : 0];
  const account = {
    host: bankCompany.hosts[0],
    number: `NX00${range(rng, 100000, 999999)}`,
    owner: handle,
    balance: 4000,
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
      rating: 2,
      credits: 4000,
      gateway: gw,
      tools: STARTER_TOOLS.map((kind) => ({ kind, level: 1 })),
      bounce: [],
      heat: 0,
      storage: [],
      accounts: [account],
      flags: {},
      stock: [],
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
    settings: { sound: true, effects: true, autosave: true, fastForward: false, timeScale: 1, fontScale: 1, darkSkin: false },
    cheats: { freezeHeat: null, freezeTrace: false },
    stats: {
      missionsDone: 0, missionsFailed: 0, hostsBreached: 0, filesStolen: 0,
      earned: 0, tracesEscaped: 0, logsWiped: 0,
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
  seedWorld(game);
  return game;
}
