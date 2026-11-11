// Thread slots: how many tasks the machine works on at once. Any number of
// tasks may be started (up to the queue limit), but only as many as the slots
// hold are processing; the rest wait their turn.

import { lanes, fpga } from '../state/gateway.js';

/// The tasks that take two thread slots: the crackers, the decrypters and the
/// voice work. Every other task takes one.
const HEAVY = new Set(['CrackPassword', 'DecryptFile', 'RecordVoice', 'CallRecord', 'SpoofCall', 'PlayVoiceprint', 'ForgeTicket']);

/// The most tasks a link holds, running and waiting together.
const QUEUE = 8;

/// What a task says when the queue is full.
export const SATURATED = 'task queue full';

/// The thread slots the machine has.
export function slots(game) { return Math.max(lanes(game.player.gateway), 1); }

/// The thread slots a task takes. The FPGA decrypts on its own silicon.
export function weight(game, kind) {
  if (kind === 'DecryptFile' && fpga(game.player.gateway) > 1) return 0;
  return HEAVY.has(kind) ? 2 : 1;
}

/// Marks which tasks are processing (`queued` false) and which wait. They take
/// slots in the order they were started; a task that does not fit waits and a
/// lighter one behind it may still run. A heavy task on one slot takes all of it.
export function schedule(game, s) {
  const all = slots(game);
  let used = 0;
  s.tasks.forEach((t) => {
    const w = Math.min(weight(game, t.kind), all);
    t.queued = used + w > all;
    if (!t.queued) used += w;
  });
}

/// The thread slots the processing tasks take.
export function demand(game, s) {
  return s.tasks.reduce((n, t) => n + (t.queued ? 0 : Math.min(weight(game, t.kind), slots(game))), 0);
}

/// How many tasks are waiting for a slot.
export function waiting(s) { return s.tasks.filter((t) => t.queued).length; }

/// Whether the queue takes another task.
export function roomFor(game, s) { return s.tasks.length < QUEUE; }
