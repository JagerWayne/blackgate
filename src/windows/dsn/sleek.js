// SleekPages: the social network, a light take on the big blue one. A feed
// of posts (a photo and a caption from data/images/socialmedia), a profile for
// every person in the world, and a people directory. Everything is picked by
// hashing the world seed, so a run always shows the same site and no draw is
// taken from the world's random numbers.

import { custom, field, buttons } from '../../ui/controls.js';
import { flat } from '../../ui/styles.js';
import { draw as drawText, ellipsize, FONT } from '../../core/text.js';
import { socialImages, socialText, cities } from '../../data/content.js';
import { portraitOf, drawPortrait, loadedImage } from '../../ui/portrait.js';
import { intelOf } from '../../state/intel.js';
import { detailLink } from './company.js';
import { wrapRow } from '../notepad.js';

const BLUE = '#3b5998';
const BG = '#e9ebee';
const CARD = '#ffffff';
const INK = '#1c1e21';
const DIM = '#606770';
const LINE = '#dddfe2';
const BASE = './data/images/socialmedia/';
const LH = 18;
const FEED_POSTS = 14;
const PAGE = 50;
/// The biggest a square photo gets.
const PHOTO_MAX = 520;

/// A number from the seed and some words: the same every time.
function hash(game, ...parts) {
  let h = 2166136261;
  for (const ch of `${game.seed}:${parts.join(':')}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

/// One post: who wrote it, its photo and caption, when, and the counts.
export function postOf(game, key, author = null) {
  const people = game.world.people;
  const who = author ?? hash(game, 'author', key) % people.length;
  const topics = Object.keys(socialImages()).filter((t) => socialImages()[t].length && socialText()[t]?.length);
  if (!topics.length) return null;
  const topic = topics[hash(game, 'topic', key) % topics.length];
  const pics = socialImages()[topic];
  const lines = socialText()[topic];
  const hours = 1 + (hash(game, 'age', key) % 70);
  return {
    who,
    topic,
    image: `${BASE}${topic}/${pics[hash(game, 'pic', key) % pics.length]}`,
    text: lines[hash(game, 'line', key) % lines.length],
    when: hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`,
    likes: hash(game, 'likes', key) % 240,
    comments: hash(game, 'comments', key) % 31,
  };
}

const inside = (input, r) => input?.mouse && input.mouse.x >= r.x && input.mouse.x <= r.x + r.w && input.mouse.y >= r.y && input.mouse.y <= r.y + r.h;
const press = (input, r) => input?.pressed && inside(input, r);
const go = (events, url) => events?.push({ type: 'click', id: `dsn.go.${url}` });
const companyOf = (game, p) => game.world.companies[p.company];
const cityOf = (game, p) => cities()[companyOf(game, p)?.city]?.name ?? 'somewhere';
const title = (s) => String(s ?? '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/// The blue bar along the top: the logo and the two places to go.
function topBar(here) {
  return custom(46, (ctx, sk, r, input, events) => {
    ctx.fillStyle = BLUE;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    drawText(ctx, 'sleekpages', r.x + 14, r.y + r.h / 2, FONT.heading, '#ffffff', { baseline: 'middle' });
    [['sleekpages', 'Feed'], ['sleekpages/people', 'People']].forEach(([url, text], i) => {
      const b = { x: r.x + r.w - 180 + i * 86, y: r.y + 9, w: 80, h: 28 };
      ctx.fillStyle = here === url ? '#ffffff' : '#4a66a0';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      drawText(ctx, text, b.x + b.w / 2, b.y + b.h / 2, FONT.body, here === url ? BLUE : '#ffffff', { align: 'center', baseline: 'middle' });
      if (press(input, b)) go(events, url);
    });
  });
}

/// A white card with a thin border.
function card(ctx, r) {
  ctx.fillStyle = CARD;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
}

/// How many lines a caption takes at a width (a close guess before a frame
/// has a context to measure with; the card keeps a spare line for it).
const guessLines = (text, w) => Math.max(Math.ceil((text.length * 7.6) / Math.max(w - 28, 40)), 1);

/// A post card: the author's face and name, the caption, the photo, the counts.
function postCard(game, post) {
  // the photo is square, as wide as the card allows up to PHOTO_MAX
  const photoH = (w) => Math.round(Math.min(w - 2, PHOTO_MAX));
  return custom((w) => 60 + (guessLines(post.text, w) + 1) * LH + photoH(w) + 44, (ctx, sk, r, input, events) => {
    const box = { x: r.x, y: r.y, w: r.w, h: r.h - 10 };
    card(ctx, box);
    const p = game.world.people[post.who];
    const face = { x: box.x + 12, y: box.y + 12, w: 40, h: 40 };
    drawPortrait(ctx, sk, face, portraitOf(game, post.who), p.sex);
    const nameW = Math.min(box.w - 80, 320);
    drawText(ctx, ellipsize(ctx, title(p.name), FONT.emphasis, nameW), face.x + 50, face.y + 4, FONT.emphasis, BLUE);
    drawText(ctx, `${post.when} · ${title(cityOf(game, p))}`, face.x + 50, face.y + 24, FONT.body, DIM);
    if (press(input, { x: face.x, y: face.y, w: nameW + 50, h: 40 })) go(events, `sleekpages/person/${post.who}`);
    let y = box.y + 62;
    wrapRow(ctx, post.text, box.w - 28).forEach((line) => {
      drawText(ctx, line, box.x + 14, y, FONT.body, INK);
      y += LH;
    });
    y += 6;
    const side = photoH(box.w);
    const ph = { x: box.x + (box.w - side) / 2, y, w: side, h: side };
    ctx.fillStyle = '#d0d4db';
    ctx.fillRect(ph.x, ph.y, ph.w, ph.h);
    const img = loadedImage(post.image);
    if (img) {
      const s = Math.max(ph.w / img.naturalWidth, ph.h / img.naturalHeight);
      const sw = ph.w / s;
      const sh = ph.h / s;
      ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, ph.x, ph.y, ph.w, ph.h);
    }
    const fy = box.y + box.h - 22;
    ctx.fillStyle = LINE;
    ctx.fillRect(box.x + 12, fy - 12, box.w - 24, 1);
    drawText(ctx, `Like ${post.likes}`, box.x + 14, fy, FONT.body, DIM, { baseline: 'middle' });
    drawText(ctx, `${post.comments} comments`, box.x + box.w - 14, fy, FONT.body, DIM, { align: 'right', baseline: 'middle' });
  });
}

/// The feed: posts from random people, a new set each time the page loads.
function feed(game, nonce) {
  const posts = Array.from({ length: FEED_POSTS }, (_, i) => postOf(game, `feed${nonce}:${i}`)).filter(Boolean);
  return [topBar('sleekpages'), ...posts.map((p) => postCard(game, p))];
}

/// A profile: the cover, the face, the about box, their posts.
function profile(game, i) {
  const p = game.world.people[i];
  if (!p) return null;
  const co = companyOf(game, p);
  const about = [
    ['Works at', co ? `${title(p.role)} at ${title(co.name)}` : title(p.role)],
    ['Lives in', title(cityOf(game, p))],
    ['Handle', 'social'],
    ['Email', 'email'],
    ['Phone', 'phone'],
  ];
  const head = custom(200, (ctx, sk, r, input, events) => {
    card(ctx, { x: r.x, y: r.y, w: r.w, h: r.h - 10 });
    const g = ctx.createLinearGradient ? ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y) : null;
    if (g) {
      g.addColorStop(0, BLUE);
      g.addColorStop(1, '#8b9dc3');
    }
    ctx.fillStyle = g ?? BLUE;
    ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, 100);
    const face = { x: r.x + 20, y: r.y + 50, w: 110, h: 110 };
    ctx.fillStyle = CARD;
    ctx.fillRect(face.x - 4, face.y - 4, face.w + 8, face.h + 8);
    drawPortrait(ctx, sk, face, portraitOf(game, i), p.sex);
    drawText(ctx, title(p.name), face.x + face.w + 18, r.y + 112, FONT.heading, INK);
    drawText(ctx, ellipsize(ctx, `${title(p.role)} · ${co ? title(co.name) : ''}`, FONT.body, r.w - face.w - 60), face.x + face.w + 18, r.y + 140, FONT.body, DIM);
    // the dossier: the person goes on file as a lead, and the window opens
    const b = { x: r.x + r.w - 150, y: r.y + 110, w: 134, h: 30 };
    ctx.fillStyle = BLUE;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    drawText(ctx, 'VIEW DOSSIER', b.x + b.w / 2, b.y + b.h / 2, FONT.body, '#ffffff', { align: 'center', baseline: 'middle' });
    if (press(input, b)) events.push({ type: 'click', id: `sp.dossier.${i}` });
  });
  // the handle, email and phone are links when public: a click files them
  const aboutBox = custom(about.length * 26 + 50, (ctx, sk, r, input, events) => {
    card(ctx, { x: r.x, y: r.y, w: r.w, h: r.h - 10 });
    drawText(ctx, 'About', r.x + 14, r.y + 12, FONT.emphasis, INK);
    about.forEach(([k, v], n) => {
      const y = r.y + 40 + n * 26;
      drawText(ctx, k, r.x + 14, y, FONT.body, DIM);
      if (['social', 'email', 'phone'].includes(v)) detailLink(ctx, game, i, v, r.x + 110, y, r.w - 130, BLUE, '#a0a6b0', input, events);
      else drawText(ctx, ellipsize(ctx, v, FONT.body, r.w - 130), r.x + 110, y, FONT.body, INK);
    });
  });
  const posts = [0, 1, 2].map((n) => postOf(game, `p${i}.${n}`, i)).filter(Boolean);
  return [topBar(''), head, aboutBox, ...posts.map((post) => postCard(game, post))];
}

/// Whether a person matches a search: name, role, company or city.
export function matches(game, p, q) {
  if (!q) return true;
  const hay = `${p.name} ${p.role} ${companyOf(game, p)?.name ?? ''} ${cityOf(game, p)}`.toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

/// People: a search over everyone, fifty to a page.
function people(game, view) {
  const q = (view.spQuery ?? '').trim();
  const found = [];
  game.world.people.forEach((p, i) => { if (matches(game, p, q)) found.push(i); });
  const pages = Math.max(Math.ceil(found.length / PAGE), 1);
  const at = Math.min(view.spPage ?? 0, pages - 1);
  const shown = found.slice(at * PAGE, at * PAGE + PAGE);
  const rows = custom(shown.length * 52 + 50, (ctx, sk, r, input, events) => {
    card(ctx, { x: r.x, y: r.y, w: r.w, h: r.h - 10 });
    drawText(ctx, `${q ? `"${q}" // ` : ''}${found.length.toLocaleString('en-US')} people // page ${at + 1} of ${pages}`, r.x + 14, r.y + 12, FONT.emphasis, INK);
    shown.forEach((i, k) => {
      const p = game.world.people[i];
      const row = { x: r.x + 1, y: r.y + 40 + k * 52, w: r.w - 2, h: 52 };
      if (inside(input, row)) {
        ctx.fillStyle = '#f2f3f5';
        ctx.fillRect(row.x, row.y, row.w, row.h);
      }
      drawPortrait(ctx, sk, { x: row.x + 12, y: row.y + 6, w: 40, h: 40 }, portraitOf(game, i), p.sex);
      drawText(ctx, title(p.name), row.x + 64, row.y + 10, FONT.emphasis, BLUE);
      const where = companyOf(game, p) ? `${title(p.role)} · ${title(companyOf(game, p).name)}` : title(p.role);
      drawText(ctx, ellipsize(ctx, `${where} · ${title(cityOf(game, p))}`, FONT.body, row.w - 80), row.x + 64, row.y + 30, FONT.body, DIM);
      if (press(input, row)) go(events, `sleekpages/person/${i}`);
    });
  });
  const nav = [];
  if (at > 0) nav.push({ id: `sp.search.page.${at - 1}`, text: '‹ PREVIOUS', style: flat() });
  if (at < pages - 1) nav.push({ id: `sp.search.page.${at + 1}`, text: 'NEXT ›', style: flat() });
  return [
    topBar('sleekpages/people'),
    field('sp.q', view.spQuery ?? '', 'search people: name, job, company or city'),
    buttons([{ id: 'sp.search.go', text: 'SEARCH', style: flat() }]),
    rows,
    ...(nav.length ? [buttons(nav)] : []),
  ];
}

/// The SleekPages page for the rest of an address, or null for a 404.
export function sleekPage(game, rest, view = {}) {
  const [part, arg] = rest.split('/');
  const nonce = view.tabs?.[view.active]?.at ?? 0;
  let controls = null;
  if (!part || part === 'feed') controls = feed(game, nonce);
  else if (part === 'people') controls = people(game, view);
  else if (part === 'person') controls = profile(game, Number(arg));
  if (!controls) return null;
  return { title: 'sleekpages', site: 'web', bg: BG, accent: 0x3b5998, controls };
}

/// Puts a person on file (a lead) for the VIEW DOSSIER button.
export function fileLead(game, i) {
  if (game.world.people[i]) intelOf(game, i);
}
