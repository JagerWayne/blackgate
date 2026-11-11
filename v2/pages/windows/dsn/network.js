// The rest of DSNET's own pages: a leak site's profile of a company, the
// rumour board, search, the about page and the browser's start page.

import { label, para, keyValue, buttons, spacer, custom, field } from '../../ui/controls.js';
import { drawButton } from '../../ui/widgets.js';
import { flat, ghost } from '../../ui/styles.js';
import { draw as drawText, ellipsize, FONT } from '../../../game/core/text.js';
import { color, cssA } from '../../../game/core/theme.js';
import { darknet } from '../../../game/data/content.js';
import { MISSION_LABEL, CO_LABEL, HOST_LABEL } from '../../../game/data/enums.js';
import { NET, UI_FONT } from './theme.js';
import { HOME, links, pageHeader, heading } from './shared.js';
import { listings, companyOf, cardsOr } from './market.js';
import { across } from './cards.js';
import { feedOf, minePosts, repliesOf, tipOf, TIP_PRICE } from '../../../game/state/board.js';
import { t as tl } from '../../../game/data/language.js';

/// A leak site's profile of a company: what the network knows about it.
export function lookup(game, idx) {
  const co = game.world.companies[idx];
  if (!co) return null;
  const staff = game.world.people.filter((p) => p.company === idx).length;
  const known = co.hosts.filter((id) => game.world.hosts[id].discovered);
  const onFile = game.world.people.filter((p, i) => p.company === idx && game.intel?.[i]).length;
  const work = listings(game).filter((c) => companyOf(game, c) === idx);
  return {
    title: `leakbase/${co.short}`,
    accent: NET.danger,
    controls: [
      pageHeader({ path: `dsn://lookup/${idx}`, title: co.name, sub: tl('windows.dsn.network.leakbase_everything_they_wish'), accent: NET.danger, tag: CO_LABEL[co.kind] ?? co.kind }),
      heading(co.name.toUpperCase()),
      keyValue('SECTOR', CO_LABEL[co.kind] ?? co.kind),
      para(co.blurb),
      keyValue('STAFF', `${staff} // ${onFile} on your file`),
      buttons([{ id: 'dsn.dossiers', text: tl('windows.dsn.network.open_dossiers'), style: ghost() }]),
      heading(`HOSTS YOU KNOW // ${known.length} OF ${co.hosts.length}`),
      ...known.map((id) => buttons([{ id: `dsn.map.${id}`, text: tl('windows.dsn.network.show_on_map', game.world.hosts[id].name, HOST_LABEL[game.world.hosts[id].kind] ?? ''), style: flat() }])),
      label(known.length < co.hosts.length ? 'an OSINT sweep on one of their hosts finds the rest' : 'every host is on your map', FONT.body, NET.dim),
      heading(`WORK AGAINST THEM // ${work.length}`),
      cardsOr(game, work, 'no open listings'),
    ],
  };
}

/// The rumour board: the day's threads, your own posts, and a thread page with replies and paid tips.
export function board(game, rest = '', view = {}) {
  const feed = feedOf(game);
  const head = pageHeader({ path: rest ? `dsn://board/${rest}` : 'dsn://board', title: 'The undernet board', sub: tl('windows.dsn.network.trust_nobody_post_anyway'), accent: NET.violet, tag: `${feed.length} THREADS` });
  if (rest) {
    const i = Number(rest);
    const post = feed[i];
    if (!Number.isInteger(i) || !post) return null;
    const tip = tipOf(game, i);
    const key = `${Math.floor(game.clock.minutes / 1440)}:${i}`;
    return {
      title: 'the undernet board',
      accent: NET.violet,
      controls: [
        head,
        links([['board', '← all threads']]),
        label(`${post.name} // thread ${i + 1}`, FONT.body, NET.muted),
        para(post.text),
        heading('REPLIES'),
        ...repliesOf(game, key, 2 + (key.length % 3)).flatMap((r) => [label(r.who, FONT.body, NET.muted), para(r.text)]),
        heading('A TIP'),
        tip ? para(tip.text, FONT.body, tip.ok ? NET.ok : NET.danger) : para(`${post.name} says they know more about ${game.world.companies[post.ci].name}. It costs ${TIP_PRICE} cr and nobody guarantees it.`),
        ...(tip ? [] : [buttons([{ id: `bd.tip.${i}`, text: tl('windows.dsn.network.buy_the_tip_cr', TIP_PRICE), style: flat() }])]),
      ],
    };
  }
  const mine = minePosts(game);
  return {
    title: 'the undernet board',
    accent: NET.violet,
    controls: [
      head,
      heading('POST', 'adds a little heat'),
      field('bd.q', view.bdText ?? '', 'say something. everyone reads it.'),
      buttons([{ id: 'bd.post', text: tl('windows.dsn.network.post'), style: flat() }]),
      ...mine.flatMap((p) => [label(`you // ${p.replies.length} repl${p.replies.length === 1 ? 'y' : 'ies'}`, FONT.body, NET.accent), para(p.text), ...p.replies.flatMap((r) => [label(`  ${r.who}`, FONT.body, NET.muted), para(`  ${r.text}`)]), spacer(8)]),
      heading('THREADS'),
      ...feed.flatMap((p, i) => [label(`${p.name} // ${i + 1}h ago`, FONT.body, NET.muted), para(p.text), links([[`board/${i}`, 'open thread']]), spacer(8)]),
    ],
  };
}

/// Search: listings, brokers and companies whose words match.
export function search(game, q) {
  const w = q.toLowerCase();
  const jobs = listings(game).filter((c) => `${c.title} ${c.brief} ${c.client} ${MISSION_LABEL[c.kind]}`.toLowerCase().includes(w));
  const brokers = Object.entries(darknet().brokers).filter(([n, b]) => `${n} ${b.domain} ${b.tagline}`.toLowerCase().includes(w));
  const cos = game.world.companies.map((c, i) => [c, i]).filter(([c]) => c.name.toLowerCase().includes(w)).slice(0, 8);
  return {
    title: `search: ${q}`,
    accent: NET.accent,
    controls: [
      pageHeader({ path: `dsn://search/${q.trim()}`, title: q.trim() ? `"${q.trim()}"` : 'Search', sub: tl('windows.dsn.network.listings_brokers_companies', jobs.length, brokers.length, cos.length), accent: NET.accent }),
      heading(`LISTINGS MATCHING "${q}" // ${jobs.length}`),
      cardsOr(game, jobs, 'no listings match'),
      heading('BROKERS'),
      brokers.length ? links(brokers.map(([n, b]) => [b.domain, n])) : label('none', FONT.body, NET.dim),
      heading('COMPANIES'),
      cos.length ? links(cos.map(([c, i]) => [`lookup/${i}`, c.name])) : label('none', FONT.body, NET.dim),
    ],
  };
}

/// About the network.
export function about() {
  return {
    title: 'about',
    accent: NET.accent,
    controls: [
      pageHeader({ path: 'dsn://about', title: 'About DSNET', sub: tl('windows.dsn.network.a_hidden_network_of'), accent: NET.accent }),
      para('A hidden network of hidden services. Every page you load is routed through three relays that know only their neighbours. The brokers here post the work; you pick it up, talk them up, and get it done.'),
      para('Rules of the house: no names, no logs, no asking for double.'),
    ],
  };
}

/// The sites this machine knows, each a tile on the start page.
const SITES = [
  [HOME, 'DSNET', 'the market for the anonymous: jobs, brokers, fees', 'D', NET.accent],
  ['sleekpages', 'SleekPages', 'the social network: who works where, who posts what', 'S', NET.violet],
  ['directory', 'Business Directory', 'the websites of every company on the network', 'B', NET.ok],
  ['eforest.nx', 'eForest', 'the hardware store: cases, boards, processors, drives and more', 'E', NET.warn],
  ['linkedup.nx', 'LinkedUp', 'the professional network: who works where, who is hiring', 'L', NET.accent],
  ['nslookup.nx', 'nslookup.nx', 'the host names a company shows to the outside', 'N', NET.ok],
  ['bazaar.nx', 'The Bazaar', 'sell the files you copied, if the buyer is real', 'Z', NET.warn],
  ['pastedump.nx', 'pastedump', 'anonymous leaks: emails and servers, new daily', 'P', NET.danger],
  ['archive.nx', 'archive.nx', 'old copies of company sites, with every server in the footer', 'A', NET.dim],
  ['whois.nx', 'whois.nx', 'who owns a domain: registrar, dates, name servers, contacts', 'W', NET.dim],
];

/// The start page's tiles: a glyph, the name, one line on what is there.
function siteTiles() {
  const TILE_H = 88;
  // the ids go with the control, so a page can be walked without drawing it
  return Object.assign(custom((w) => Math.ceil(SITES.length / across(w)) * (TILE_H + 10) - 10, (ctx, sk, r, input, events, st) => {
    const n = across(r.w);
    const tw = Math.floor((r.w - 10 * (n - 1)) / n);
    SITES.forEach(([url, name, desc, glyph, tint], i) => {
      const t = { x: r.x + (i % n) * (tw + 10), y: r.y + Math.floor(i / n) * (TILE_H + 10), w: tw, h: TILE_H };
      const hot = st.hover === `dsn.go.${url}`;
      ctx.fillStyle = color(hot ? sk.raised : sk.panel2);
      ctx.fillRect(t.x, t.y, t.w, t.h);
      ctx.strokeStyle = hot ? cssA(tint, 0.6) : color(sk.line);
      ctx.lineWidth = 1;
      ctx.strokeRect(t.x + 0.5, t.y + 0.5, t.w - 1, t.h - 1);
      if (drawButton(ctx, st, sk, `dsn.go.${url}`, t, '', { ...flat(), tip: `${name}: ${desc}` }, input)) events.push({ type: 'click', id: `dsn.go.${url}` });
      const sq = { x: t.x + 14, y: t.y + 14, w: 36, h: 36 };
      ctx.fillStyle = cssA(tint, 0.18);
      ctx.fillRect(sq.x, sq.y, sq.w, sq.h);
      drawText(ctx, glyph, sq.x + sq.w / 2, sq.y + sq.h / 2 + 1, FONT.heading, color(tint), { align: 'center', baseline: 'middle', family: UI_FONT });
      drawText(ctx, ellipsize(ctx, name, FONT.emphasis, t.w - 80, UI_FONT), t.x + 64, t.y + 14, FONT.emphasis, color(sk.text_hi), { family: UI_FONT });
      drawText(ctx, ellipsize(ctx, desc, FONT.body, t.w - 80, UI_FONT), t.x + 64, t.y + 40, FONT.body, color(sk.dim), { family: UI_FONT });
    });
  }), { ids: SITES.map(([url]) => `dsn.go.${url}`), dom: { type: 'sites', sites: SITES } });
}

/// The start page: the sites this machine knows.
export function startPage() {
  return {
    title: 'start',
    accent: NET.accent,
    site: 'web',
    controls: [
      pageHeader({ path: 'dsn://start', title: 'Internet XPlorer', sub: tl('windows.dsn.network.type_an_address_or'), accent: NET.accent }),
      heading('BOOKMARKS'),
      siteTiles(),
      spacer(10),
      label('the address bar searches too: type a company, a broker or a word and press GO', FONT.body, NET.muted),
    ],
  };
}
