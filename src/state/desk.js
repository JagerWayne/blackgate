// The desk: the header along the top, the taskbar along the bottom and the
// desktop the windows live on between them.

export const HEADER_H = 56;
export const BAR_H = 42;

/// The desktop rect, between the header and the taskbar.
export function desktop(w, h) {
  return { x: 0, y: HEADER_H, w, h: h - HEADER_H - BAR_H };
}
