// Several notepads. The open one's text lives in game.notes (what the editor
// and the `notepad` commands use); the others wait in game.notepads.

export const MAX_PADS = 12;

/// Fills in the pad list for a run that has none (new or old save).
export function padsOf(game) {
  if (!Array.isArray(game.notepads) || !game.notepads.length) {
    // an old save's notes keep the name they had; a new run starts untitled
    game.notepads = [{ name: game.notes ? 'NOTES' : 'UNTITLED', text: game.notes ?? '' }];
    game.notepad = 0;
  }
  game.notepad = Math.min(Math.max(game.notepad ?? 0, 0), game.notepads.length - 1);
  return game.notepads;
}

/// Puts the open text back into its pad.
function stash(game) {
  padsOf(game)[game.notepad].text = game.notes ?? '';
}

export function openPad(game, i) {
  stash(game);
  if (i < 0 || i >= game.notepads.length) return false;
  game.notepad = i;
  game.notes = game.notepads[i].text;
  return true;
}

export function newPad(game, name) {
  stash(game);
  if (game.notepads.length >= MAX_PADS) return false;
  game.notepads.push({ name: (name || untitled(game)).toUpperCase().slice(0, 16), text: '' });
  return openPad(game, game.notepads.length - 1);
}

/// Deletes a pad; the last one left is emptied instead.
export function deletePad(game, i) {
  stash(game);
  if (i < 0 || i >= game.notepads.length) return false;
  if (game.notepads.length === 1) game.notepads[0] = { name: 'UNTITLED', text: '' };
  else {
    game.notepads.splice(i, 1);
    if (i < game.notepad) game.notepad -= 1;
  }
  game.notepad = Math.min(game.notepad, game.notepads.length - 1);
  game.notes = game.notepads[game.notepad].text;
  return true;
}

/// The first free UNTITLED name: UNTITLED, then UNTITLED 2, 3...
function untitled(game) {
  const used = new Set(game.notepads.map((p) => p.name));
  if (!used.has('UNTITLED')) return 'UNTITLED';
  let n = 2;
  while (used.has(`UNTITLED ${n}`)) n += 1;
  return `UNTITLED ${n}`;
}
