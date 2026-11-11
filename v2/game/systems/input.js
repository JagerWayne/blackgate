// The input store: one frame of pointer and keyboard state. The browser
// events land in the store; the systems read it; the edges are cleared once
// the frame has been simulated.

import { attachKeys, release } from './keyboard.js';

export function makeInput() {
  return {
    mouse: { x: 0, y: 0 },
    inside: false,
    down: false,
    pressed: false,
    released: false,
    rightPressed: false,
    scroll: 0,
    shift: false,
    ctrl: false,
    enter: false,
    esc: false,
    tab: false,
    backspace: false,
    delete: false,
    up: false,
    downKey: false,
    left: false,
    right: false,
    home: false,
    end: false,
    anyKey: false,
    text: '',
    typed: '',
    paste: '',
  };
}

/// Attaches the browser listeners: the pointer to the canvas, the keys to
/// the page.
export function attach(canvas, input, win = globalThis.window) {
  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  canvas.addEventListener('pointermove', (e) => {
    const p = pos(e);
    input.mouse.x = p.x;
    input.mouse.y = p.y;
    input.inside = true;
  });
  canvas.addEventListener('pointerleave', () => {
    input.inside = false;
  });
  canvas.addEventListener('pointerdown', (e) => {
    const p = pos(e);
    input.mouse.x = p.x;
    input.mouse.y = p.y;
    input.inside = true;
    if (e.button === 2) {
      input.rightPressed = true;
    } else {
      input.down = true;
      input.pressed = true;
    }
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointerup', (e) => {
    if (e.button !== 2) {
      input.down = false;
      input.released = true;
    }
  });
  canvas.addEventListener('pointercancel', () => release(input));
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener(
    'wheel',
    (e) => {
      // positive is toward the top: every scroller takes it off its offset,
      // so rolling the wheel down (a positive deltaY) moves the content down
      input.scroll -= e.deltaY;
      e.preventDefault();
    },
    { passive: false },
  );
  attachKeys(win, input);
}

/// Clears the edges, so a press is seen by exactly one frame.
export function endFrame(input) {
  input.pressed = false;
  input.released = false;
  input.rightPressed = false;
  input.scroll = 0;
  input.enter = false;
  input.esc = false;
  input.tab = false;
  input.backspace = false;
  input.delete = false;
  input.up = false;
  input.downKey = false;
  input.left = false;
  input.right = false;
  input.home = false;
  input.end = false;
  input.anyKey = false;
  input.text = '';
  input.typed = '';
  input.paste = '';
}
