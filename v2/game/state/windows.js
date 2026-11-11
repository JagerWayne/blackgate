import { t as tl } from '../data/language.js';
// The windows the shell holds open: their boxes, their order and the drags
// that move them.

/// The applications, with the size each one opens at.
export const WINDOWS = [
  // the four every desk has, in this order: the web, the computer, the hacking client, the money
  { key: 'dsn', title: tl('state.windows.internet_xplorer'), about: tl('state.windows.browse_dsnet_the_hidden'), w: 1060, h: 720, minW: 600, minH: 400 },
  { key: 'files', title: tl('state.windows.my_computer'), about: tl('state.windows.your_gateway_s_drive'), w: 760, h: 540, minW: 420, minH: 300 },
  { key: 'blackgate', title: tl('state.windows.bl_ckg_te'), about: tl('state.windows.the_hacking_client_the'), w: 1180, h: 720, minW: 760, minH: 460 },
  { key: 'bank', title: tl('state.windows.money'), about: tl('state.windows.your_money_savings_loans'), w: 720, h: 540, minW: 320, minH: 240 },
  { key: 'mail', title: tl('state.windows.outlook'), about: tl('state.windows.your_mail_job_offers'), w: 800, h: 560, minW: 320, minH: 240 },
  { key: 'gateway', title: tl('state.windows.device_manager'), about: tl('state.windows.your_machine_its_case'), w: 1300, h: 780, minW: 520, minH: 420 },
  { key: 'software', title: tl('state.windows.app_store'), about: tl('state.windows.buy_and_upgrade_the'), w: 900, h: 640, minW: 320, minH: 240 },
  { key: 'operator', title: tl('state.windows.control_panel'), about: tl('state.windows.your_profile_and_rating'), w: 760, h: 600, minW: 420, minH: 320 },
  { key: 'notepad', title: tl('state.windows.notepad'), about: tl('state.windows.write_down_what_you'), w: 560, h: 460, minW: 320, minH: 240 },
  { key: 'terminal', title: tl('state.windows.command_prompt'), about: tl('state.windows.drive_the_game_by'), w: 860, h: 540, minW: 420, minH: 260 },
  { key: 'calc', title: tl('state.windows.calculator'), about: tl('state.windows.a_pocket_calculator'), w: 320, h: 440, minW: 260, minH: 360 },
  { key: 'info', title: tl('state.windows.info'), about: tl('state.windows.how_to_play_and'), w: 980, h: 660, minW: 560, minH: 360 },
  // opened from the BLACKGATE logo in the header, not from the Start menu
  { key: 'cheats', title: tl('state.windows.debug'), about: tl('state.windows.the_debug_menu_cheats'), w: 760, h: 520, minW: 360, minH: 300, hidden: true },
  { key: 'missions', title: tl('state.windows.mission_builder'), about: tl('state.windows.build_your_own_jobs'), w: 1040, h: 720, minW: 680, minH: 440, hidden: true },
];

/// Apps that live as a tab of another window: the old key -> [window, tab].
/// Opening one by its old name opens the window on that tab.
export const MERGED = {
  map: ['blackgate', 'map'], network: ['blackgate', 'network'], dossiers: ['blackgate', 'dossiers'],
  stats: ['operator', 'stats'], settings: ['operator', 'settings'], news: ['mail', 'news'],
};
/// The window an app opens in.
const home = (key) => MERGED[key]?.[0] ?? key;

/// The window manager: the open windows and the drag that is in progress.
export function makeWindows() {
  return { list: [], zTop: 10, drag: null, resize: null };
}

/// The definition of an application.
export function windowDef(key) {
  return WINDOWS.find((w) => w.key === home(key));
}

/// The open window with a key.
export function findWindow(mgr, key) {
  return mgr.list.find((w) => w.key === home(key));
}

/// Opens an application, or brings it to the front.
export function openWindow(mgr, key, desktop) {
  const def = windowDef(key);
  if (!def) return null;
  // an app that is a tab opens its window on that tab
  const sub = MERGED[key]?.[1] ?? null;
  const existing = findWindow(mgr, key);
  if (existing) {
    if (sub) existing.sub = sub;
    existing.min = false;
    existing.z = mgr.zTop += 1;
    return existing;
  }
  const n = mgr.list.length;
  const win = {
    key: def.key,
    sub,
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
  mgr.list = mgr.list.filter((w) => w.key !== home(key));
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
