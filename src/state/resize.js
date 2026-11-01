// The grab zones and the resize drag of a window.

/// The grab zones around a window: the sides, the bottom and the corners.
export function resizeHandles(w) {
  const CORNER = 14;
  const EDGE = 5;
  const l = w.x;
  const t = w.y + 26;
  const r = w.x + w.w;
  const b = w.y + w.h;
  return [
    { edge: 'bottomLeft', x: l, y: b - CORNER, w: CORNER, h: CORNER },
    { edge: 'bottomRight', x: r - CORNER, y: b - CORNER, w: CORNER, h: CORNER },
    { edge: 'left', x: l, y: t, w: EDGE, h: b - CORNER - t },
    { edge: 'right', x: r - EDGE, y: t, w: EDGE, h: b - CORNER - t },
    { edge: 'bottom', x: l + CORNER, y: b - EDGE, w: r - l - CORNER * 2, h: EDGE },
  ];
}

/// The new box for a resize drag: the held edge follows the pointer.
export function resizeBox(win, edge, pointer, press) {
  let left = win.x;
  let right = win.x + win.w;
  let top = win.y;
  let bottom = win.y + win.h;
  if (edge === 'left' || edge === 'bottomLeft') left = pointer.x + (win.x - press.x);
  if (edge === 'right' || edge === 'bottomRight') right = pointer.x + (win.x + win.w - press.x);
  if (edge === 'bottom' || edge === 'bottomLeft' || edge === 'bottomRight') {
    bottom = pointer.y + (win.y + win.h - press.y);
  }
  if (right - left < win.minW) {
    if (edge === 'left' || edge === 'bottomLeft') left = right - win.minW;
    else right = left + win.minW;
  }
  if (bottom - top < win.minH) bottom = top + win.minH;
  return { x: left, y: top, w: right - left, h: bottom - top };
}
