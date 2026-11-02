// The play screen: the header, the desktop, the windows and the taskbar.

import { draw as drawText } from '../core/text.js';
import { color } from '../core/theme.js';
import { drawHeader, drawDesktop, drawTaskbar, drawToasts } from './shell.js';
import { HEADER_H, BAR_H, desktop } from '../state/desk.js';
import { drawWindow } from './windowFrame.js';
import { drawStartMenu, startMenuRect } from './startMenu.js';
import { drawOver } from './over.js';
import { blind, hit } from '../ui/kit.js';
import { ordered, clampWindows, openWindow, windowDef, windowAt } from '../state/windows.js';
import { drawMail } from '../windows/mail.js';
import { drawContracts } from '../windows/contracts.js';
import { drawGateway } from '../windows/gateway.js';
import { drawSoftware } from '../windows/software.js';
import { drawFiles } from '../windows/files.js';
import { drawNews } from '../windows/news.js';
import { drawBank } from '../windows/bank.js';
import { drawStats } from '../windows/stats.js';
import { drawSettings } from '../windows/settings.js';
import { drawNotepad } from '../windows/notepad.js';
import { drawDossiers } from '../windows/people.js';
import { drawMap } from '../windows/map.js';
import { drawSession } from '../windows/session.js';
import { drawCheats } from '../windows/cheats.js';
import { drawMissions } from '../windows/missions.js';
import { drawTerminal } from '../windows/terminal.js';
import { saveRun } from '../state/save.js';

/// The applications, by window key.
const APPS = {
  mail: drawMail,
  contracts: drawContracts,
  gateway: drawGateway,
  software: drawSoftware,
  files: drawFiles,
  news: drawNews,
  bank: drawBank,
  stats: drawStats,
  settings: drawSettings,
  notepad: drawNotepad,
  dossiers: drawDossiers,
  map: drawMap,
  blackgate: drawSession,
  cheats: drawCheats,
  missions: drawMissions,
  terminal: drawTerminal,
};

// the desktop geometry lives with the state, so the state can place windows
export { desktop };

/// Draws the shell and the windows on it.
export function drawPlay(ctx, sk, w, h, state, events) {
  const game = state.game;
  const desk = desktop(w, h);
  // once the run is over, only the ending takes the pointer
  const input = game.gameOver ? blind(state.input) : state.input;
  // the pointer belongs to the open Start menu, or else to the top window
  const { x: mx, y: my } = input.mouse;
  const onMenu = state.startOpen && hit(startMenuRect({ x: 0, y: 0, w, h }), input);
  const top = onMenu ? null : windowAt(state.windows, mx, my);
  drawDesktop(ctx, sk, desk, state.wallpaper);
  clampWindows(state.windows, desk);
  ordered(state.windows).forEach((win) => {
    const own = win === top ? input : blind(input);
    const box = drawWindow(ctx, sk, win, state.windows, state.ui, own, events);
    const app = APPS[win.key];
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    if (app) {
      state.win[win.key] = state.win[win.key] ?? {};
      app(ctx, sk, box, game, state.ui, own, events, state.win[win.key]);
    } else {
      drawText(ctx, `${windowDef(win.key)?.title ?? win.key} // not available yet`, box.x, box.y, 11, color(sk.dim));
    }
    ctx.restore();
  });
  drawHeader(ctx, game, sk, { x: 0, y: 0, w, h: HEADER_H }, state.ui, input, events);
  drawTaskbar(ctx, game, sk, { x: 0, y: h - BAR_H, w, h: BAR_H }, state.windows, state.ui, input, events);
  drawToasts(ctx, game, sk, { x: 0, y: 0, w, h });
  if (state.startOpen) {
    const picked = drawStartMenu(ctx, sk, { x: 0, y: 0, w, h }, game, state.ui, input);
    if (picked === '__power__') {
      // the machine goes down: the run is written out first, so it is not lost
      if (game && game.settings.autosave) saveRun(game);
      state.mode = 'off';
    } else if (picked) {
      openWindow(state.windows, picked, desk);
      state.startOpen = false;
    }
  }
  if (game.gameOver) drawOver(ctx, sk, w, h, game, state.ui, state.input, events);
}
