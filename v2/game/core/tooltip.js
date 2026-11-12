// Tooltips. Hover the pointer over something for a moment and its full text
// appears. Two sources feed it, both rebuilt every frame:
//   - text that was cut short with an ellipsis: ellipsize() remembers the full
//     text and draw() turns the cut text into a hover area, so every list and
//     card shows the whole text on hover, with no code at the call site;
//   - explicit tips: addTip(rect, text), and a table of button tips by id.
// Windows are drawn bottom to top; `layer` marks which window a hover area
// belongs to, so a window on top hides the areas of the ones under it.

const DELAY = 0.35;
const MAX_W = 340;

let regions = [];
let layers = [];
const cut = new Map();
let hover = { sig: null, since: 0 };

/// The tips for buttons, by the start of their id.
const TIPS = {
  'sess.disconnect': 'Close the link. The logs you left behind turn into heat.',
  'sess.burn': 'Panic button: drops every task and slows the trace for 10 seconds, at a cost of heat. Once per link.',
  'sess.crack': 'Try passwords until this service opens.',
  'sess.hijack': 'Steal a live login session to get past the two-step code.',
  'sess.copy': 'Download this file onto your computer (My Computer, in downloads).',
  'sess.del': 'Delete this file on the host for good.',
  'sess.decrypt': 'Unscramble this encrypted file so it can be copied.',
  'sess.task.': 'Run this action on the host. If it cannot run, the text under the buttons says why.',
  'ct.submit.': 'Hand the finished work in to get paid.',
  'ct.link.': 'Open a link to this job\'s target machine through your route.',
  'ct.track.': 'Show this job\'s target on the Nexus Map.',
  'dsn.drop.': 'Give the job up. It counts against your rating.',
  'dsn.sort.': 'Order the listings this way.',
  'dsn.rail': 'Fold the rail down to icons, or open it again.',
  'dsn.side.': 'Go to this place on DSNET.',
  'mail.readAll': 'Mark every message as read.',
  'mail.open.': 'Open this job\'s deal page in Internet XPlorer.',
  'files.del.': 'Remove this file from your computer.',
  'bank.dep.': 'Move credits from your pocket into savings.',
  'bank.wd.': 'Take credits out of savings.',
  'bank.borrow.': 'Borrow credits. Interest builds every day and the loan is due in a week.',
  'bank.repay.': 'Pay the loan back.',
  'bank.buy.': 'Buy this coin with credits. A 1% fee applies.',
  'bank.sell.': 'Sell this coin for credits. A 1% fee applies.',
  'sw.buy.': 'Buy or upgrade this tool. It also takes room on your drive.',
  'sw.back': 'Back to the list of apps.',
  'set.save': 'Save the run now.',
  'set.quit': 'Save the run and log out.',
  'hdr.speed': 'World clock speed. Click to step through the speeds.',
  'hdr.pause': 'Pause or resume the world clock (Space also does it).',
  'hdr.contracts': 'The jobs in hand: opens your list of jobs.',
  'gw.': 'Change your machine: its parts, its case and the supply line.',
};

/// The tip for a button id, or ''.
export function tipFor(id) {
  const key = Object.keys(TIPS).find((k) => id.startsWith(k));
  return key ? TIPS[key] : '';
}

/// Starts a frame: forgets the last one's areas.
export function tipsBegin() {
  regions = [];
  layers = [];
  cut.clear();
}

/// A new window (or menu) starts to be drawn on top of what came before.
export function tipLayer(box) {
  layers.push(box);
}

/// ellipsize() cut `full` down to `shown`.
export function noteCut(shown, full) {
  cut.set(shown, full);
}

/// draw() put `shown` on the screen at this box: if it was cut, it can be hovered.
export function noteText(shown, box) {
  const full = cut.get(shown);
  if (full) regions.push({ ...box, text: full, layer: layers.length - 1 });
}

/// Something to hover: the box and the words.
export function addTip(box, text) {
  if (text) regions.push({ x: box.x, y: box.y, w: box.w, h: box.h, text, layer: layers.length - 1 });
}

const inside = (b, x, y) => b && x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;

/// The words under the pointer, or null: the topmost area that no window above covers.
function under(x, y) {
  for (let i = regions.length - 1; i >= 0; i -= 1) {
    const r = regions[i];
    if (!inside(r, x, y)) continue;
    let covered = false;
    for (let l = r.layer + 1; l < layers.length; l += 1) if (inside(layers[l], x, y)) covered = true;
    if (!covered) return r;
  }
  return null;
}

/// Draws the tooltip for the pointer, once it has rested a moment. `wrap` is
/// the text wrapper (so this file stays free of drawing imports).
export function drawTip(ctx, sk, input, now, screen, wrap, drawText, color, size, measure) {
  if (!input.inside) return;
  const r = under(input.mouse.x, input.mouse.y);
  const sig = r ? `${r.text}|${r.x}|${r.y}` : null;
  if (sig !== hover.sig) hover = { sig, since: now };
  if (!r || now - hover.since < DELAY || input.pressed) return;
  // each line of the text is wrapped on its own, so a line break stays a line break
  const lines = r.text.split(String.fromCharCode(10)).flatMap((p) => wrap(ctx, p, size, MAX_W - 16)).slice(0, 14);
  const lh = size * 1.45;
  // measured in the same font the text is drawn in, or the box comes out too narrow
  const w = Math.min(MAX_W, Math.max(...lines.map((l) => measure(ctx, l, size))) + 16);
  const h = lines.length * lh + 12;
  const x = Math.min(input.mouse.x + 14, screen.w - w - 4);
  const y = input.mouse.y + 20 + h > screen.h ? input.mouse.y - h - 8 : input.mouse.y + 20;
  ctx.save();
  ctx.fillStyle = color(sk.menu_bg ?? sk.panel);
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = color(sk.accent);
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.restore();
  lines.forEach((l, i) => drawText(ctx, l, x + 8, y + 6 + i * lh, size, color(sk.text_hi)));
}
