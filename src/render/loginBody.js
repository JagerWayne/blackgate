// The new-session entry under the users: a tile with the handle field. Every
// new run gets a random world.

import { draw as drawText, ellipsize } from '../core/text.js';
import { drawField } from '../ui/field.js';
import { safeName, profilesFull, MAX_PROFILES } from '../state/save.js';
import { pick, tile, goRect, goButton, SANS, NEW_H } from './loginUsers.js';

/// Draws the new-session entry at y.
export function drawLoginBody(ctx, st, sk, list, y, input, ui, events) {
  const r = { x: list.x, y, w: list.w, h: NEW_H - 6 };
  if (r.y + r.h > list.y + list.h + 12) return;
  pick(st, r, 0, input);
  const on = st.sel === 0;
  const go = { ...goRect(r), y: r.y + 30 };
  const fx = r.x + 66;
  const fr = { x: fx, y: r.y + 32, w: Math.max((on ? go.x - 8 : r.x + r.w - 8) - fx, 40), h: 24 };
  tile(ctx, r, on, 'New session', '', '#2b8fd6', '+', r.x + r.w - 8);
  const handle = drawField(ctx, ui, sk, 'login.handle', fr, st.handle, 'type a handle', false, input);
  if (handle !== null) {
    st.handle = handle;
    events.push({ type: 'edit', id: 'login.handle', value: handle });
  }
  if (!on) return;
  goButton(ctx, sk, go, input, ui, events);
  // one save per operator: a new run under a saved handle is written over it
  const name = st.handle.trim() || 'OPERATOR';
  const same = st.slots.find((s) => safeName(s.handle) === safeName(name));
  const full = profilesFull(st.slots, st.handle);
  const line = same ? `replaces the saved run of ${same.handle}`
    : full ? `${MAX_PROFILES} profiles in use // delete one first` : `profile ${st.slots.length + 1} of ${MAX_PROFILES} // a new world of 2,000 people`;
  drawText(ctx, ellipsize(ctx, line, 11, r.x + r.w - fx - 8, SANS), fx, r.y + 72, 11, same || full ? '#ff6a50' : '#d6e4ff', {
    baseline: 'middle', family: SANS,
  });
}
