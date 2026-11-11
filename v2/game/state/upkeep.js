// The running costs of the rig: every game day the operator pays for power,
// the line and the room the machine sits in. The bill is a small base plus a
// share of what the rig is worth, so a bigger machine costs more to keep. It
// starts once the tutorial is done. What the balance cannot cover waits as
// arrears and is taken from the next credits that come in.

import { chassisDef, boardDef, componentDef } from '../data/content.js';
import { adjust, note, toast } from './gameHelpers.js';
import { t as tl } from '../data/language.js';

/// The daily base, and the share of the rig's value a day costs.
export const UPKEEP_BASE = 60;
export const UPKEEP_RATE = 0.02;

/// The daily bill of a rig worth `value` credits.
export const upkeepPerDay = (value) => Math.round(UPKEEP_BASE + UPKEEP_RATE * value);

/// What the rig is worth: the case, the board and every part fitted.
export function rigValue(game) {
  const g = game.player.gateway;
  return (chassisDef(g.chassis)?.price ?? 0) + (boardDef(g.board)?.price ?? 0)
    + g.parts.reduce((n, p) => n + (componentDef(p.kind, p.level)?.price ?? 0), 0);
}

/// Do the running costs apply yet? Not during the tutorial.
export const upkeepOn = (game) => !game.tutorial?.on;

/// Takes what the balance covers of the arrears.
export function collectArrears(game) {
  const b = game.bank;
  if (!b?.arrears) return;
  const take = Math.min(b.arrears, game.player.credits);
  if (take <= 0) return;
  adjust(game, -take, 'running costs (arrears)');
  b.arrears -= take;
  if (b.arrears === 0) note(game, 'running costs: arrears cleared');
}

/// One game day's bill: the balance pays what it can and the rest is owed.
export function billDay(game) {
  if (!upkeepOn(game)) return;
  const b = game.bank;
  const due = upkeepPerDay(rigValue(game));
  const paid = Math.min(due, game.player.credits);
  if (paid > 0) adjust(game, -paid, 'running costs');
  if (paid < due) {
    b.arrears = (b.arrears ?? 0) + (due - paid);
    toast(game, tl('state.upkeep.running_costs_unpaid_cr', b.arrears), 'bad');
  }
}
