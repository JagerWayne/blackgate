// The keyboard, the clipboard and the page losing focus, into the input
// store. Nothing stays held once the page is left.

/// The keys the game uses that the browser would otherwise act on.
const KEPT = new Set(['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace', ' ']);

/// Lets go of every held button and key.
export function release(input) {
  input.down = false;
  input.shift = false;
  input.ctrl = false;
}

/// Attaches the key, paste and focus listeners to the page.
export function attachKeys(win, input) {
  win.addEventListener('keydown', (e) => {
    if (KEPT.has(e.key)) e.preventDefault();
    input.anyKey = true;
    input.shift = !!e.shiftKey;
    input.ctrl = !!(e.ctrlKey || e.metaKey);
    if (e.key === 'Enter') input.enter = true;
    if (e.key === 'Escape') input.esc = true;
    if (e.key === 'Tab') input.tab = true;
    if (e.key === 'Backspace') input.backspace = true;
    if (e.key === 'Delete') input.delete = true;
    if (e.key === 'ArrowUp') input.up = true;
    if (e.key === 'ArrowDown') input.downKey = true;
    if (e.key === 'ArrowLeft') input.left = true;
    if (e.key === 'ArrowRight') input.right = true;
    if (e.key?.length === 1 && !e.ctrlKey && !e.metaKey) input.text += e.key;
    // the same keys in the order they came, for a text that takes more than
    // one line: a new line is \n, a deleted character \b
    if (e.key === 'Enter') input.typed += '\n';
    else if (e.key === 'Backspace') input.typed += '\b';
    else if (e.key?.length === 1 && !e.ctrlKey && !e.metaKey) input.typed += e.key;
  });
  win.addEventListener('keyup', (e) => {
    input.shift = !!e.shiftKey;
    input.ctrl = !!(e.ctrlKey || e.metaKey);
  });
  // the canvas never holds focus, so the paste is read from the page
  win.addEventListener('paste', (e) => {
    input.paste = e.clipboardData?.getData('text') ?? '';
  });
  win.addEventListener('blur', () => release(input));
  win.document?.addEventListener('visibilitychange', () => release(input));
}
