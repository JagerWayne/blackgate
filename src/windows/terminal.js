// Command Prompt: type commands to drive the other applications. A click on
// the window (or the backtick key) takes the typing. Enter runs the line,
// Tab completes it, Up and Down recall earlier lines, Escape clears it, and
// the wheel scrolls the output. The lines run after the frame, in
// runPending, so a command never changes the windows while they are drawn.

import { draw as drawText, lineHeight, measure, ellipsize, FONT } from '../core/text.js';
import { color } from '../core/theme.js';
import { hit } from '../ui/kit.js';
import { makeTerm, run, print, complete } from '../systems/commands.js';

const SIZE = FONT.body;

/// The terminal state, made the first time the window is drawn.
function termOf(view) {
  view.term ??= makeTerm();
  return view.term;
}

/// Draws the prompt and takes the typing while it has the focus.
export function drawTerminal(ctx, sk, r, game, ui, input, events, view) {
  const term = termOf(view);
  if (!term.greeted) {
    term.greeted = true;
    print(term, [{ text: 'BLACKGATE command prompt // type `help` to start', tone: 'head' }]);
  }
  if (hit(r, input) && input.pressed) ui.focus = 'terminal';
  // Escape leaves the field in the keyboard model; here it clears the line
  if (ui.escFrom === 'terminal') {
    term.input = '';
    ui.focus = 'terminal';
  }
  const focused = ui.focus === 'terminal';
  if (focused) takeKeys(term, game, input, view);

  const lh = lineHeight(SIZE);
  ctx.fillStyle = color(sk.inset);
  ctx.fillRect(r.x, r.y, r.w, r.h);
  const promptY = r.y + r.h - lh - 6;
  const rows = Math.max(Math.floor((promptY - r.y - 8) / lh), 1);
  // the wheel scrolls back through the output; new output brings it home
  const maxBack = Math.max(term.lines.length - rows, 0);
  if (hit(r, input) && Math.abs(input.scroll) > 0.1) view.back = (view.back ?? 0) + Math.sign(input.scroll) * 3;
  view.back = Math.max(0, Math.min(view.back ?? 0, maxBack));
  const end = term.lines.length - view.back;
  const shown = term.lines.slice(Math.max(end - rows, 0), end);
  const tone = { echo: sk.accent, err: sk.danger, ok: sk.ok, head: sk.inset_text, info: sk.warn };
  shown.forEach((l, i) => {
    drawText(ctx, ellipsize(ctx, l.text, SIZE, r.w - 16), r.x + 8, r.y + 6 + i * lh, SIZE, color(tone[l.tone] ?? sk.inset_text));
  });
  if (view.back) drawText(ctx, `-- ${view.back} lines back // wheel down to return --`, r.x + r.w - 8, r.y + 6, SIZE, color(sk.warn), { align: 'right' });

  // the prompt line, with a blinking cursor while it has the typing
  ctx.fillStyle = color(sk.line);
  ctx.fillRect(r.x, promptY - 4, r.w, 1);
  const prompt = `${game.player.handle.toLowerCase()}@blackgate> `;
  drawText(ctx, prompt, r.x + 8, promptY, SIZE, color(sk.accent));
  const px = r.x + 8 + measure(ctx, prompt, SIZE);
  const room = r.w - (px - r.x) - 16;
  // a long line shows its end, where the typing is
  let text = term.input;
  while (text.length && measure(ctx, text, SIZE) > room) text = text.slice(1);
  drawText(ctx, text, px, promptY, SIZE, color(sk.inset_text));
  if (focused && Math.floor((game.uiTime ?? 0) * 2) % 2 === 0) {
    ctx.fillStyle = color(sk.inset_text);
    ctx.fillRect(px + measure(ctx, text, SIZE) + 1, promptY, 7, lh - 2);
  }
  if (!focused) drawText(ctx, 'click here or press ` to type', r.x + r.w - 8, promptY, SIZE, color(sk.dim), { align: 'right' });
}

/// The keys of one frame: typing, Enter, Tab, Up and Down.
function takeKeys(term, game, input, view) {
  for (const ch of input.typed ?? '') {
    if (ch === '\n') {
      if (term.input.trim()) (view.pending ??= []).push(term.input);
      term.input = '';
      term.at = -1;
      view.back = 0;
    } else if (ch === '\b') term.input = term.input.slice(0, -1);
    else if (ch !== '`' && ch !== '\t') term.input += ch;
  }
  if (input.paste) term.input += input.paste.replace(/[\r\n]+/g, ' ');
  if (input.up && term.history.length) {
    term.at = term.at < 0 ? term.history.length - 1 : Math.max(term.at - 1, 0);
    term.input = term.history[term.at];
  }
  if (input.downKey && term.at >= 0) {
    term.at += 1;
    term.input = term.at < term.history.length ? term.history[term.at] : '';
    if (term.at >= term.history.length) term.at = -1;
  }
  if (input.tab) {
    const { line, hits } = complete({ game }, term.input);
    term.input = line;
    if (hits.length) print(term, [{ text: hits.join('   '), tone: 'info' }]);
  }
}

/// Runs the lines typed this frame. Called once the frame's events are in.
export function runPending(state, desk) {
  const view = state.win?.terminal;
  if (!view?.pending?.length || !state.game) return;
  const lines = view.pending;
  view.pending = [];
  for (const line of lines) {
    if (!state.game) break;
    run(state, termOf(view), line, desk);
  }
}
