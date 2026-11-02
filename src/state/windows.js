// The windows the shell holds open: their boxes, their order and the drags
// that move them.

/// The applications, with the size each one opens at.
export const WINDOWS = [
  { key: 'blackgate', title: 'Bl@ckG@te', w: 1180, h: 720, minW: 760, minH: 460 },
  { key: 'mail', title: 'MAIL', w: 800, h: 560, minW: 320, minH: 240 },
  { key: 'dsn', title: 'DeppSpaceNET', w: 1060, h: 720, minW: 600, minH: 400 },
  { key: 'map', title: 'NEXUS MAP', w: 1040, h: 690, minW: 520, minH: 380 },
  { key: 'gateway', title: 'GATEWAY', w: 780, h: 620, minW: 320, minH: 240 },
  { key: 'software', title: 'SOFTWARE', w: 900, h: 640, minW: 320, minH: 240 },
  { key: 'files', title: 'STORAGE', w: 640, h: 500, minW: 320, minH: 240 },
  { key: 'bank', title: 'BANKING', w: 720, h: 540, minW: 320, minH: 240 },
  { key: 'dossiers', title: 'DOSSIERS', w: 980, h: 640, minW: 560, minH: 360 },
  { key: 'news', title: 'NEWSWIRE', w: 660, h: 580, minW: 320, minH: 240 },
  { key: 'stats', title: 'OPERATOR', w: 620, h: 540, minW: 320, minH: 240 },
  { key: 'settings', title: 'SYSTEM', w: 600, h: 480, minW: 320, minH: 240 },
  { key: 'notepad', title: 'Notepad', w: 560, h: 460, minW: 320, minH: 240 },
  { key: 'terminal', title: 'Command Prompt', w: 860, h: 540, minW: 420, minH: 260 },
  // opened from the BLACKGATE logo in the header, not from the Start menu
  { key: 'cheats', title: 'CHEATS', w: 760, h: 520, minW: 360, minH: 300, hidden: true },
  { key: 'missions', title: 'MISSION BUILDER', w: 1040, h: 720, minW: 680, minH: 440, hidden: true },
];

/// The window manager: the open windows and the drag that is in progress.
export function makeWindows() {
  return { list: [], zTop: 10, drag: null, resize: null };
}

/// The definition of an application.
export function windowDef(key) {
  return WINDOWS.find((w) => w.key === key);
}

/// The open window with a key.
export function findWindow(mgr, key) {
  return mgr.list.find((w) => w.key === key);
}

/// Opens an application, or brings it to the front.
export function openWindow(mgr, key, desktop) {
  const def = windowDef(key);
  if (!def) return null;
  const existing = findWindow(mgr, key);
  if (existing) {
    existing.min = false;
    existing.z = mgr.zTop += 1;
    return existing;
  }
  const n = mgr.list.length;
  const win = {
    key,
    title: def.title,
    x: desktop.x + 20 + n * 26,
    y: desktop.y + 14 + n * 22,
    w: def.w,
    h: def.h,
    minW: def.minW,
    minH: def.minH,
    z: mgr.zTop += 1,
  };
  mgr.list.push(win);
  return win;
}

/// Closes an application.
export function closeWindow(mgr, key) {
  mgr.list = mgr.list.filter((w) => w.key !== key);
}

/// The windows on the desktop, bottom first. A minimized window is only on
/// the taskbar.
export function ordered(mgr) {
  return mgr.list.filter((w) => !w.min).sort((a, b) => a.z - b.z);
}

/// The box a window shows in: the whole desktop while it is maximized.
export function boxOf(mgr, w) {
  return w.max && mgr.desk ? mgr.desk : w;
}

/// The caption buttons: minimize tucks a window away, maximize toggles.
export function minimizeWindow(mgr, key) {
  const w = findWindow(mgr, key);
  if (w) Object.assign(w, { min: true, max: false });
}
export function toggleMax(mgr, key) {
  const w = findWindow(mgr, key);
  if (w) w.max = !w.max;
}

/// A taskbar button: brings a window back, or tucks away the one in front.
export function taskWindow(mgr, key, desktop) {
  const w = findWindow(mgr, key);
  if (w && w === ordered(mgr).at(-1)) minimizeWindow(mgr, key);
  else openWindow(mgr, key, desktop);
}

/// The window the pointer is over, if any.
export function windowAt(mgr, x, y) {
  const list = ordered(mgr);
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const b = boxOf(mgr, list[i]);
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return list[i];
  }
  return null;
}

/// Keeps every window on the desktop, and remembers the desktop for the
/// maximized ones.
export function clampWindows(mgr, desktop) {
  mgr.desk = desktop;
  mgr.list.forEach((w) => {
    w.w = Math.min(Math.max(w.w, w.minW), Math.max(desktop.w - 8, w.minW));
    w.h = Math.min(Math.max(w.h, w.minH), Math.max(desktop.h - 8, w.minH));
    w.x = Math.min(Math.max(w.x, desktop.x), Math.max(desktop.x + desktop.w - w.w, desktop.x));
    w.y = Math.min(Math.max(w.y, desktop.y), Math.max(desktop.y + desktop.h - w.h, desktop.y));
  });
}

// the resize geometry lives in its own file
export { resizeHandles, resizeBox } from './resize.js';
