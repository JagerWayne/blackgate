import { t as tl } from '../data/language.js';
// Perks and daily modifiers. Both are lists of multipliers on a few named
// numbers; `perk(game, key, base)` folds the ones in play into a base value.
// shortcut: the lists live in code, not data/; move them when there are many.

/// A perk is offered every PERK_EVERY finished jobs, three to choose from.
export const PERK_EVERY = 3;

export const PERKS = [
  { id: 'ghost', label: 'Ghost Protocol', text: tl('state.perks.trace_runs_25_slower'), tweaks: { trace: 0.75, pay: 0.85 } },
  { id: 'sprinter', label: 'Sprinter', text: tl('state.perks.tasks_finish_20_faster'), tweaks: { dur: 0.8, trace: 1.15 } },
  { id: 'mercenary', label: 'Mercenary', text: tl('state.perks.jobs_pay_25_more'), tweaks: { pay: 1.25, trace: 1.2 } },
  { id: 'patient', label: 'Patient Hand', text: tl('state.perks.tasks_take_25_longer'), tweaks: { dur: 1.25, trace: 0.65 } },
  { id: 'gambler', label: 'Gambler', text: tl('state.perks.jobs_pay_40_more'), tweaks: { pay: 1.4, trace: 1.3, dur: 1.1 } },
];

/// Today's modifiers, one per daily world.
export const MODS = [
  { id: 'hawk', label: 'Hawk-eyed', text: tl('state.perks.trace_x1_5_pay'), tweaks: { trace: 1.5, pay: 1.5 } },
  { id: 'quiet', label: 'Quiet day', text: tl('state.perks.trace_x0_7_pay'), tweaks: { trace: 0.7, pay: 0.8 } },
  { id: 'rush', label: 'Rush hour', text: tl('state.perks.tasks_x0_75_time'), tweaks: { dur: 0.75, trace: 1.25 } },
];

/// The multipliers in play for one key, folded into `base`.
export function perk(game, key, base = 1) {
  return [...(game.perks ?? []), game.mod].filter(Boolean).reduce((v, p) => v * (p.tweaks[key] ?? 1), base);
}

/// The perks on offer now, or [] when none is due.
export function perkOffer(game) {
  const have = game.perks ?? [];
  if (game.stats.missionsDone < PERK_EVERY * (have.length + 1)) return [];
  return PERKS.filter((p) => !have.some((x) => x.id === p.id)).slice(0, 3);
}

/// Takes a perk from the offer. Returns an error text or null.
export function choosePerk(game, id) {
  const p = perkOffer(game).find((x) => x.id === id);
  if (!p) return 'that perk is not on offer';
  (game.perks ??= []).push(p);
  return null;
}
