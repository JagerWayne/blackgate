// A window: the caption, the buttons on it, the drag that moves it and the
// grips that resize it.

import { draw as drawText, ellipsize } from '../core/text.js';
import { color, mix } from '../core/theme.js';
import { hit } from '../ui/kit.js';
import { resizeHandles, resizeBox, boxOf } from '../state/windows.js';

/// Draws the chrome of a window and returns the box its content goes in.
export function drawWindow(ctx, sk, win, mgr, ui, input, events) {
  // a maximized window fills the desktop and holds still
  const b = boxOf(mgr, win);
  const r = { x: b.x, y: b.y, w: b.w, h: b.h };
  const title = { x: r.x, y: r.y, w: r.w, h: 34 };
  // the click on the body brings the window to the front
  if (hit(r, input) && input.pressed) win.z = mgr.zTop += 1;

  // the caption buttons
  const bs = 24;
  const closeX = r.x + r.w - 6 - bs;
  const maxX = closeX - (bs + 2);
  const minX = maxX - (bs + 2);
  const capBtn = (x, glyph, id) => {
    const br = { x, y: r.y + 5, w: bs, h: bs };
    const hot = hit(br, input);
    const base = id === 'close' ? 0xd9463e : 0x2e77e4;
    const top = id === 'close' ? 0xe87b74 : 0x5fa0f2;
    const g = ctx.createLinearGradient(br.x, br.y, br.x, br.y + br.h);
    g.addColorStop(0, color(hot ? top : mix(top, base, 0.4)));
    g.addColorStop(1, color(base));
    ctx.fillStyle = g;
    ctx.fillRect(br.x, br.y, br.w, br.h);
    drawText(ctx, glyph, br.x + br.w / 2, br.y + br.h / 2, 9, '#ffffff', { align: 'center', baseline: 'middle' });
    if (hot && input.pressed) {
      events.push({ type: 'click', id: `${id}.${win.key}` });
      return true;
    }
    return false;
  };

  // the drag on the caption, unless a caption button was hit
  const onButton = hit({ x: minX, y: r.y + 5, w: r.w - minX + r.x, h: bs }, input);
  if (hit(title, input) && input.pressed && !onButton && !win.max) {
    mgr.drag = { key: win.key, dx: input.mouse.x - win.x, dy: input.mouse.y - win.y };
  }
  if (mgr.drag && mgr.drag.key === win.key) {
    if (input.down) {
      win.x = input.mouse.x - mgr.drag.dx;
      win.y = input.mouse.y - mgr.drag.dy;
    } else mgr.drag = null;
  }

  // the resize grips
  for (const z of win.max ? [] : resizeHandles(win)) {
    if (hit(z, input) && input.pressed) {
      // the box at the press: every frame of the drag measures from it, not
      // from the box the last frame left behind
      const start = { x: win.x, y: win.y, w: win.w, h: win.h, minW: win.minW, minH: win.minH };
      mgr.resize = { key: win.key, edge: z.edge, pressX: input.mouse.x, pressY: input.mouse.y, start };
    }
  }
  if (mgr.resize && mgr.resize.key === win.key) {
    if (input.down) {
      const box = resizeBox(mgr.resize.start, mgr.resize.edge, { x: input.mouse.x, y: input.mouse.y }, { x: mgr.resize.pressX, y: mgr.resize.pressY });
      win.x = box.x;
      win.y = box.y;
      win.w = box.w;
      win.h = box.h;
    } else mgr.resize = null;
  }

  // the frame
  ctx.fillStyle = color(sk.panel);
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = color(sk.xp_border);
  ctx.lineWidth = 1;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);

  // the caption
  const active = win.z === mgr.zTop;
  const g = ctx.createLinearGradient(title.x, title.y, title.x, title.y + title.h);
  if (active) {
    g.addColorStop(0, color(sk.xp_title_a));
    g.addColorStop(1, color(sk.xp_title_b));
  } else {
    g.addColorStop(0, color(sk.xp_title_in));
    g.addColorStop(1, color(mix(sk.xp_title_in, 0xffffff, 0.35)));
  }
  ctx.fillStyle = g;
  ctx.fillRect(title.x, title.y, title.w, title.h);
  drawText(ctx, ellipsize(ctx, win.title, 11, title.w - 140), title.x + 10, title.y + title.h / 2, 11, color(sk.xp_white), { baseline: 'middle' });
  capBtn(minX, '\u2013', 'win.min');
  capBtn(maxX, win.max ? '\u29C9' : '\u25A1', 'win.max');
  capBtn(closeX, '\u2715', 'win.close');

  // the grips in the bottom corners
  for (const z of win.max ? [] : resizeHandles(win)) {
    if (!z.edge.startsWith('bottom')) continue;
    const hot = hit(z, input);
    const at = z.edge === 'bottomLeft' ? { x: z.x + 3, y: z.y + z.h - 3 } : { x: z.x + z.w - 3, y: z.y + z.h - 3 };
    const dir = z.edge === 'bottomLeft' ? 1 : -1;
    ctx.strokeStyle = color(hot ? sk.accent : sk.line);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 3; i += 1) {
      const d = i * 4;
      ctx.moveTo(at.x + dir * d, at.y);
      ctx.lineTo(at.x, at.y - d);
    }
    ctx.stroke();
  }

  // the content goes inside, with the ten pixel kerning
  return { x: r.x + 10, y: title.y + title.h + 10, w: r.w - 20, h: r.h - title.h - 20 };
}
