// Notepad: the operator's own notes, kept in the save file. A click on the
// page takes the typing; Enter starts a line, Backspace takes one character.
//
// The page numbers its lines in a gutter, wraps them or not (the switch is
// kept with the run), and scrolls both ways: the wheel scrolls down the page,
// Shift and the wheel across it, and both thumbs drag. Typing brings the end
// of the page back into view.

import { draw as drawText, lineHeight, measure, ellipsize, FONT } from '../core/text.js';
import { color } from '../core/theme.js';
import { drawFrame } from '../ui/panel.js';
import { hit } from '../ui/kit.js';
import { drawButton } from '../ui/widgets.js';
import { ghost, danger, primary } from '../ui/styles.js';
import { padsOf, MAX_PADS } from '../state/notes.js';

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
  // a different pad, or a page changed from outside, puts the caret at the end
  if (view.padAt !== game.notepad || view.caret > game.notes.length) view.caret = null;
  view.padAt = game.notepad;
  const before = game.notes;
  const caretBefore = view.caret;
  if (focused) {
    const ed = edit(game.notes, view.caret ?? game.notes.length, input);
    game.notes = ed.text;
    view.caret = ed.caret;
  }
  const changed = game.notes !== before || view.caret !== caretBefore;
  // typing again puts an armed CLEAR down
  if (focused && input.typed) view.armed = null;
  const wrap = game.settings.noteWrap !== false;
  // an empty page is no lines at all, not one blank one
  const count = game.notes ? game.notes.split('\n').length : 0;
  const frame = drawFrame(ctx, sk, r, ui, input, events, '', `${count} ${count === 1 ? 'line' : 'lines'} // ${game.notes.length} chars // click the page to type`);

  const body = drawPadTabs(ctx, sk, frame, game, ui, input, events, view);
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
  // the caret's row and where along it the caret sits
  const at = view.caret ?? game.notes.length;
  const cRow = caretRow(rows, at);
  const caretPx = measure(ctx, rows[cRow].text.slice(0, at - rows[cRow].start), SIZE);
  if (v === undefined) v = maxV;
  if (changed) {
    // typing or moving keeps the caret in view
    if (cRow * lh < v) v = cRow * lh;
    if ((cRow + 1) * lh > v + textH) v = (cRow + 1) * lh - textH;
    if (!wrap) {
      if (caretPx - h > fullW - 12) h = caretPx - fullW + 24;
      if (caretPx < h) h = Math.max(caretPx - 24, 0);
    }
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
  // a press on the text puts the caret there
  const textBox = { x: textX - 2, y: page.y + 8, w: fullW + 4, h: textH };
  if (input.pressed && !view.drag && hit(textBox, input) && rows.length) {
    const ri = clamp(Math.floor((input.mouse.y - textBox.y + v) / lh), 0, rows.length - 1);
    const row = rows[ri];
    const x = input.mouse.x - (textX - h);
    let k = 0;
    while (k < row.text.length && measure(ctx, row.text.slice(0, k + 1), SIZE) - measure(ctx, row.text[k], SIZE) / 2 < x) k += 1;
    view.caret = row.start + k;
  }
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
    const ci = caretRow(rows, view.caret ?? game.notes.length);
    const cr = rows[ci];
    const caretX = textX - h + measure(ctx, cr.text.slice(0, (view.caret ?? game.notes.length) - cr.start), SIZE);
    ctx.fillStyle = color(sk.text);
    ctx.fillRect(caretX + 1, top + ci * lh - v, 1, SIZE + 2);
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
  let start = 0;
  lines.forEach((line, i) => {
    const parts = wrap ? wrapRow(ctx, line, width) : [line];
    let at = start;
    parts.forEach((text, k) => {
      rows.push({ text, num: k === 0 ? i + 1 : null, start: at });
      at += text.length;
    });
    start += line.length + 1;
  });
  return rows;
}

/// The row a caret offset sits on: the last row that starts at or before it.
function caretRow(rows, at) {
  let i = 0;
  while (i + 1 < rows.length && rows[i + 1].start <= at) i += 1;
  return i;
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

/// The text and caret after this frame's keys: the arrows, Home and End move
/// the caret; typing, Backspace and Delete work at it, in the order they came.
export function edit(text, caret, input) {
  let t = text;
  let c = clamp(caret, 0, t.length);
  const lineStart = (i) => t.lastIndexOf('\n', i - 1) + 1;
  const lineEnd = (i) => (t.indexOf('\n', i) < 0 ? t.length : t.indexOf('\n', i));
  if (input.left) c = Math.max(c - 1, 0);
  if (input.right) c = Math.min(c + 1, t.length);
  if (input.home) c = lineStart(c);
  if (input.end) c = lineEnd(c);
  if (input.up && lineStart(c) > 0) {
    const col = c - lineStart(c);
    const prev = lineStart(lineStart(c) - 1);
    c = Math.min(prev + col, lineStart(c) - 1);
  } else if (input.downKey && lineEnd(c) < t.length) {
    const col = c - lineStart(c);
    const next = lineEnd(c) + 1;
    c = Math.min(next + col, lineEnd(next));
  }
  for (const ch of input.typed ?? '') {
    if (ch === '\b') {
      if (c > 0) {
        t = t.slice(0, c - 1) + t.slice(c);
        c -= 1;
      }
    } else if (t.length < MAX_CHARS) {
      t = t.slice(0, c) + ch + t.slice(c);
      c += 1;
    }
  }
  if (input.delete && c < t.length) t = t.slice(0, c) + t.slice(c + 1);
  if (input.paste) {
    const p = input.paste.replace(/\r\n?/g, '\n').slice(0, Math.max(MAX_CHARS - t.length, 0));
    t = t.slice(0, c) + p + t.slice(c);
    c += p.length;
  }
  return { text: t, caret: c };
}

/// The notepad tabs: one per pad (× deletes, pressed twice), and + NEW.
/// Returns the body below them.
function drawPadTabs(ctx, sk, body, game, ui, input, events, view) {
  const pads = padsOf(game);
  const h = 26;
  let x = body.x;
  const room = body.w - 70;
  const w = Math.max(Math.min(Math.floor(room / pads.length) - 4, 150), 60);
  pads.forEach((p, i) => {
    const open = i === game.notepad;
    const tab = { x, y: body.y, w, h };
    const del = { x: x + w - 20, y: body.y + 5, w: 16, h: 16 };
    const sure = view.armed === `note.del.${i}`;
    ctx.fillStyle = color(open ? sk.raised : sk.panel2);
    ctx.fillRect(tab.x, tab.y, tab.w, tab.h);
    ctx.fillStyle = color(open ? sk.accent : sk.line);
    ctx.fillRect(tab.x, tab.y + h - 2, tab.w, 2);
    drawText(ctx, ellipsize(ctx, sure ? 'DELETE?' : p.name, FONT.body, w - 30), x + 8, body.y + h / 2, FONT.body, color(sure ? sk.danger : open ? sk.text_hi : sk.dim), { baseline: 'middle' });
    ctx.strokeStyle = color(sure ? sk.danger : sk.dim);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(del.x + 4, del.y + 4); ctx.lineTo(del.x + 12, del.y + 12);
    ctx.moveTo(del.x + 12, del.y + 4); ctx.lineTo(del.x + 4, del.y + 12);
    ctx.stroke();
    if (input.pressed && hit(del, input)) events.push({ type: 'click', id: `note.del.${i}` });
    else if (input.pressed && !open && hit(tab, input)) events.push({ type: 'click', id: `note.open.${i}` });
    x += w + 4;
  });
  const add = { x: Math.min(x, body.x + body.w - 64), y: body.y, w: 64, h };
  if (drawButton(ctx, ui, sk, 'note.new', add, '+ NEW', { ...primary(), disabled: pads.length >= MAX_PADS }, input)) events.push({ type: 'click', id: 'note.new' });
  return { x: body.x, y: body.y + h + 8, w: body.w, h: body.h - h - 8 };
}
