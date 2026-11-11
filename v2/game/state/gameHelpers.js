// The small helpers every system uses: ids, mail, notes, money and lookups.

import { appsUsed } from './apps.js';
import { sharedDrive, storage, systemCap, downloadCap } from './gateway.js';

/// The next free id.
export function newId(game) {
  const id = game.nextId;
  game.nextId += 1;
  return id;
}

/// Puts a message in the mailbox.
export function pushMail(game, mail) {
  if (!mail.id) mail.id = newId(game);
  game.mail.push(mail);
  if (game.mail.length > 400) game.mail.shift();
}

/// Writes a line in the operator's log.
export function note(game, text) {
  game.log.push({ minute: game.clock.minutes, text });
  if (game.log.length > 400) game.log.shift();
}

/// Shows a toast.
export function toast(game, text, kind = 'info') {
  game.toasts.push({ text, kind, born: game.uiTime });
}

/// Pays money in.
export function pay(game, amount, reason) {
  game.player.credits += amount;
  const a = game.player.accounts[0];
  if (a) {
    a.balance += amount;
    const w = game.world.accounts.find((x) => x.number === a.number);
    if (w) w.balance = a.balance;
  }
  game.stats.earned += amount;
  note(game, `ledger +${amount} cr // ${reason}`);
  ledger(game, amount, reason);
}

/// Pays money back: into the account and the ledger like any payment, but
/// not counted as earnings (a part sold back is not a job done).
export function refund(game, amount, reason) {
  game.player.credits += amount;
  const a = game.player.accounts[0];
  if (a) {
    a.balance += amount;
    const w = game.world.accounts.find((x) => x.number === a.number);
    if (w) w.balance = a.balance;
  }
  note(game, `ledger +${amount} cr // ${reason}`);
  ledger(game, amount, reason);
}

/// Moves money either way outside the game's own rules (the cheat menu): it
/// goes through the account and the ledger like any payment, is never counted
/// as earnings, and never takes the balance below nothing. Returns the amount
/// that moved.
export function adjust(game, amount, reason) {
  const delta = Math.max(Math.round(amount), -game.player.credits);
  if (delta === 0) return 0;
  game.player.credits += delta;
  const a = game.player.accounts[0];
  if (a) {
    a.balance += delta;
    const w = game.world.accounts.find((x) => x.number === a.number);
    if (w) w.balance = a.balance;
  }
  note(game, `ledger ${delta > 0 ? '+' : ''}${delta} cr // ${reason}`);
  ledger(game, delta, reason);
  return delta;
}

/// The most money movements the ledger keeps.
const LEDGER_MAX = 500;

/// Books a movement of money in the ledger, which keeps its own history: the
/// operator's log scrolls everything else past, and would lose it.
function ledger(game, amount, reason) {
  if (!Array.isArray(game.ledger)) game.ledger = [];
  game.ledger.push({ minute: game.clock.minutes, amount, reason, balance: game.player.credits });
  if (game.ledger.length > LEDGER_MAX) game.ledger.shift();
}

/// Takes money out. Returns false when there is not enough.
export function charge(game, amount, reason) {
  if (game.player.credits < amount) return false;
  game.player.credits -= amount;
  const a = game.player.accounts[0];
  if (a) {
    a.balance -= amount;
    const w = game.world.accounts.find((x) => x.number === a.number);
    if (w) w.balance = a.balance;
  }
  note(game, `ledger -${amount} cr // ${reason}`);
  ledger(game, -amount, reason);
  return true;
}

/// The host with an id.
export function host(game, id) {
  return game.world.hosts[id];
}

/// Marks a host as known.
export function discover(game, id) {
  game.world.hosts[id].discovered = true;
}

/// Adds or removes a bounce hop.
export function toggleBounce(game, id) {
  const at = game.player.bounce.indexOf(id);
  if (at >= 0) game.player.bounce.splice(at, 1);
  else if (game.player.bounce.length < 8) game.player.bounce.push(id);
}

/// Bookmarks a host on the map.
export function toggleFavorite(game, id) {
  const at = game.favorites.indexOf(id);
  if (at >= 0) {
    game.favorites.splice(at, 1);
    return false;
  }
  game.favorites.push(id);
  return true;
}

/// The trace reduction the current route gives.
export function routeFactor(game) {
  return Math.max(1 - 0.085 * game.player.bounce.length, 0.35);
}

/// The name of the company that owns a host.
export function companyName(game, id) {
  const c = game.world.hosts[id].company;
  return c === null || c === undefined ? 'INDEPENDENT' : game.world.companies[c].name;
}

/// The tool level the operator has, or zero.
export function toolLevel(game, kind) {
  return game.player.tools.find((t) => t.kind === kind)?.level ?? 0;
}

/// Does the operator have the tool at all?
export function hasTool(game, kind) {
  return toolLevel(game, kind) > 0;
}

/// How much of the gateway is taken: the files downloaded and the software installed.
export function storageUsed(game) {
  return downloadsUsed(game) + appsUsed(game);
}

/// The GB of downloaded files.
export function downloadsUsed(game) {
  return game.player.storage.reduce((n, f) => n + f.size, 0);
}

/// The room left for new apps, in GB: on the system drive, or on the one
/// drive when it is shared. Negative when the apps no longer fit.
export function systemFree(game) {
  const g = game.player.gateway;
  return sharedDrive(g) ? storage(g) - storageUsed(game) : systemCap(g) - appsUsed(game);
}

/// The room left for new downloads, in GB: on the download drives, or on the
/// one drive when it is shared. Negative when the files no longer fit.
export function downloadFree(game) {
  const g = game.player.gateway;
  return sharedDrive(g) ? storage(g) - storageUsed(game) : downloadCap(g) - downloadsUsed(game);
}
