// Notepad: the operator's own notes, kept in the save file. A click on the
// page takes the typing; Enter starts a line, Backspace takes one character.
//
// The page numbers its lines in a gutter, wraps them or not (the switch is
// kept with the run), and scrolls both ways: the wheel scrolls down the page,
// Shift and the wheel across it, and both thumbs drag. Typing brings the end
// of the page back into view.

import { draw as drawText, lineHeight, measure, FONT } from '../core/text.js';
import { color } from '../core/theme.js';
import { drawFrame } from '../ui/panel.js';
import { hit } from '../ui/kit.js';
import { drawButton } from '../ui/widgets.js';
import { ghost, danger } from '../ui/styles.js';

/// The longest the notes may grow.
const MAX_CHARS = 8000;
const SIZE = FONT.body;
/// The thickness of a scrollbar, and the smallest a thumb gets.
const BAR = 10;
const MIN_THUMB = 24;

/// Draws the notepad window and takes the typing when it has the focus.
export function drawNotepad(ctx, sk, r, game, ui, input, events, view = {}) {
  // the keys go in first, so the counts and the page show the same text
  if (hit(r, input) && input.pressed) ui.focus = 'notepad';
  const focused = ui.focus === 'notepad';
  const before = game.notes;
  if (focused) game.notes = typed(game.notes, input);
  const changed = game.notes !== before;
  // typing again puts an armed CLEAR down
  if (focused && input.typed) view.armed = null;
  const wrap = game.settings.noteWrap !== false;
  // an empty page is no lines at all, not one blank one
  const count = game.notes ? game.notes.split('\n').length : 0;
  const body = drawFrame(ctx, sk, r, ui, input, events, '', `${count} ${count === 1 ? 'line' : 'lines'} // ${game.notes.length} chars // click the page to type`);

  // the switches: wrap, and the page wipe (the first click arms it)
  const sure = view.armed === 'note.clear';
  const clear = { x: body.x + body.w - 170, y: body.y, w: 170, h: 28 };
  const wrapBtn = { x: clear.x - 150, y: body.y, w: 140, h: 28 };
  if (drawButton(ctx, ui, sk, 'note.wrap', wrapBtn, wrap ? 'WRAP: ON' : 'WRAP: OFF', ghost(), input)) {
    events.push({ type: 'click', id: 'note.wrap' });
  }
  const clearStyle = sure ? danger() : { ...ghost(), disabled: !game.notes };
  if (drawButton(ctx, ui, sk, 'note.clear', clear, sure ? 'CONFIRM CLEAR' : 'CLEAR PAGE', clearStyle, input)) {
    events.push({ type: 'click', id: 'note.clear' });
  }
  if (sure) drawText(ctx, 'every line goes // click again', body.x, body.y + 14, SIZE, color(sk.danger), { baseline: 'middle' });

  const page = { x: body.x, y: body.y + 36, w: body.w, h: Math.max(body.h - 36, 40) };
  view.page = page;
  ctx.fillStyle = color(sk.panel2);
  ctx.fillRect(page.x, page.y, page.w, page.h);

  if (!game.notes && !focused) {
    drawBorder(ctx, sk, page, focused);
    drawText(ctx, 'click here and type - your notes are kept in the save file', page.x + 10, page.y + 10, SIZE, color(sk.dim));
    view.maxV = 0;
    view.maxH = 0;
    return;
  }

  // -- the layout: the gutter, the text, the bars -----------------------------
  const lines = game.notes.split('\n');
  const gutterW = Math.max(measure(ctx, String(lines.length), SIZE) + 18, 36);
  const lh = lineHeight(SIZE);
  const textX = page.x + gutterW + 8;
  const fullW = Math.max(page.x + page.w - BAR - 6 - textX, 20);
  // the rows only change with the text, the wrap or the width: kept between frames
  const cache = view.layout;
  if (!cache || cache.notes !== game.notes || cache.wrap !== wrap || cache.width !== fullW) {
    const laid = layoutRows(ctx, lines, wrap, fullW);
    const widest = wrap ? 0 : laid.reduce((m, row) => Math.max(m, measure(ctx, row.text, SIZE)), 0) + 12;
    view.layout = { notes: game.notes, wrap, width: fullW, rows: laid, contentW: widest };
  }
  const { rows, contentW } = view.layout;
  const maxH = wrap ? 0 : Math.max(contentW - fullW, 0);
  const textH = Math.max(page.h - 16 - (maxH > 0 ? BAR + 2 : 0), lh);
  const maxV = Math.max(rows.length * lh - textH, 0);
  view.maxV = maxV;
  view.maxH = maxH;

  // -- where the page is scrolled to -----------------------------------------
  // a new page, or one just typed into, shows its end and the caret
  let v = ui.scroll.get('note.v');
  let h = ui.scroll.get('note.h') ?? 0;
  if (v === undefined || changed) v = maxV;
  if (changed && !wrap) {
    const caret = measure(ctx, lines[lines.length - 1], SIZE);
    if (caret - h > fullW - 12) h = caret - fullW + 24;
    if (caret < h) h = Math.max(caret - 24, 0);
  }
  // the wheel: down the page, or across it with Shift held
  if (hit(page, input) && Math.abs(input.scroll) > 0.1) {
    if (input.shift) h -= input.scroll * 0.6;
    else v -= input.scroll * 0.6;
  }
  const vTrack = { x: page.x + page.w - BAR - 2, y: page.y + 2, w: BAR, h: page.h - 4 - (maxH > 0 ? BAR + 2 : 0) };
  const hTrack = { x: page.x + gutterW, y: page.y + page.h - BAR - 2, w: page.w - gutterW - BAR - 6, h: BAR };
  const vThumb = thumbLen(vTrack.h, textH, rows.length * lh);
  const hThumb = thumbLen(hTrack.w, fullW, contentW);
  // the thumbs drag: a press on a track takes it, the held pointer moves it.
  // A press on the thumb keeps hold of it where it was taken; a press on the
  // bare track brings the thumb's middle to the pointer.
  if (input.pressed && maxV > 0 && hit(vTrack, input)) {
    const at = vTrack.y + (vTrack.h - vThumb) * (v / maxV);
    const on = input.mouse.y >= at && input.mouse.y <= at + vThumb;
    view.drag = 'v';
    view.grab = on ? input.mouse.y - at : vThumb / 2;
  } else if (input.pressed && maxH > 0 && hit(hTrack, input)) {
    const at = hTrack.x + (hTrack.w - hThumb) * (h / maxH);
    const on = input.mouse.x >= at && input.mouse.x <= at + hThumb;
    view.drag = 'h';
    view.grab = on ? input.mouse.x - at : hThumb / 2;
  }
  if (view.drag && !input.down) view.drag = null;
  if (view.drag === 'v') v = fromTrack(input.mouse.y - vTrack.y, vTrack.h, vThumb, view.grab) * maxV;
  if (view.drag === 'h') h = fromTrack(input.mouse.x - hTrack.x, hTrack.w, hThumb, view.grab) * maxH;
  v = clamp(v, 0, maxV);
  h = clamp(h, 0, maxH);
  ui.scroll.set('note.v', v);
  ui.scroll.set('note.h', h);

  // -- the gutter and the text ---------------------------------------------------
  ctx.fillStyle = color(sk.panel);
  ctx.fillRect(page.x, page.y, gutterW, page.h);
  ctx.strokeStyle = color(sk.line);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(page.x + gutterW + 0.5, page.y);
  ctx.lineTo(page.x + gutterW + 0.5, page.y + page.h);
  ctx.stroke();
  const top = page.y + 8;
  const first = Math.max(Math.floor(v / lh), 0);
  const last = Math.min(Math.ceil((v + textH) / lh), rows.length);
  // the numbers, clipped to the height of the text
  ctx.save();
  ctx.beginPath();
  ctx.rect(page.x, top, gutterW, textH);
  ctx.clip();
  for (let i = first; i < last; i += 1) {
    if (rows[i].num) drawText(ctx, String(rows[i].num), page.x + gutterW - 8, top + i * lh - v, SIZE, color(sk.dim), { align: 'right' });
  }
  ctx.restore();
  // the text, clipped to its own box and shifted by both scrolls
  ctx.save();
  ctx.beginPath();
  ctx.rect(textX - 2, top, fullW + 4, textH);
  ctx.clip();
  for (let i = first; i < last; i += 1) {
    drawText(ctx, rows[i].text, textX - h, top + i * lh - v, SIZE, color(sk.text));
  }
  if (focused) {
    const end = rows[rows.length - 1];
    const caretX = textX - h + measure(ctx, end.text, SIZE);
    ctx.fillStyle = color(sk.text);
    ctx.fillRect(caretX + 1, top + (rows.length - 1) * lh - v, 1, SIZE + 2);
  }
  ctx.restore();

  // -- the bars ---------------------------------------------------------------------
  if (maxV > 0) drawBar(ctx, sk, vTrack, vThumb, v / maxV, true);
  if (maxH > 0) drawBar(ctx, sk, hTrack, hThumb, h / maxH, false);
  drawBorder(ctx, sk, page, focused);
}

/// The rows the page shows: each line once when wrap is off, or broken to
/// the width when it is on. Only the first row of a line carries its number.
function layoutRows(ctx, lines, wrap, width) {
  const rows = [];
  lines.forEach((line, i) => {
    const parts = wrap ? wrapRow(ctx, line, width) : [line];
    parts.forEach((text, k) => rows.push({ text, num: k === 0 ? i + 1 : null }));
  });
  return rows;
}

/// One line broken to a width, keeping every character: the rows put back
/// together are the line exactly. It breaks after the spaces (which hang at
/// the end of a row, as in any editor) and through a word that is wider than
/// the page on its own, and the next word carries on after the broken one.
export function wrapRow(ctx, line, width) {
  if (!line) return [''];
  const out = [];
  let cur = '';
  for (const tok of line.match(/\s+|\S+/g)) {
    if (/^\s+$/.test(tok) || measure(ctx, cur + tok, SIZE) <= width) {
      cur += tok;
      continue;
    }
    if (cur) out.push(cur);
    cur = '';
    if (measure(ctx, tok, SIZE) <= width) {
      cur = tok;
      continue;
    }
    for (const ch of tok) {
      if (cur && measure(ctx, cur + ch, SIZE) > width) {
        out.push(cur);
        cur = '';
      }
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/// How long a thumb is on a track, for a view of a content.
function thumbLen(track, view, content) {
  if (content <= 0) return track;
  return Math.min(Math.max((track * view) / content, MIN_THUMB), track);
}

/// Where along a track a pointer puts the scroll, from 0 to 1. The pointer
/// holds the thumb `grab` pixels from its start.
function fromTrack(at, track, thumb, grab = thumb / 2) {
  const room = track - thumb;
  return room > 0 ? clamp((at - grab) / room, 0, 1) : 0;
}

/// Draws a scrollbar: the groove and the thumb at its place.
function drawBar(ctx, sk, track, thumb, frac, vertical) {
  ctx.fillStyle = color(sk.track ?? sk.deep);
  ctx.fillRect(track.x, track.y, track.w, track.h);
  ctx.fillStyle = color(sk.line_hi);
  if (vertical) ctx.fillRect(track.x + 2, track.y + (track.h - thumb) * frac, track.w - 4, thumb);
  else ctx.fillRect(track.x + (track.w - thumb) * frac, track.y + 2, thumb, track.h - 4);
}

/// The page's border: the accent while it takes the typing.
function drawBorder(ctx, sk, page, focused) {
  ctx.strokeStyle = color(focused ? sk.accent : sk.line);
  ctx.lineWidth = focused ? 2 : 1;
  ctx.strokeRect(page.x + 0.5, page.y + 0.5, page.w - 1, page.h - 1);
}

function clamp(n, lo, hi) {
  return Math.min(Math.max(n, lo), hi);
}

/// The notes after this frame's keys, played back in the order they came.
function typed(notes, input) {
  let next = notes;
  for (const ch of input.typed ?? '') {
    next = ch === '\b' ? next.slice(0, -1) : next + ch;
  }
  if (input.paste) next += input.paste.replace(/\r\n?/g, '\n');
  return next.slice(0, MAX_CHARS);
}
