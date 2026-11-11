// The market pages of DSNET: the hub, the categories, a broker's site, one
// listing, and MY JOBS. Each opens with the same header, then its blocks.

import { label, para, keyValue, buttons, field, chips, spacer, custom } from '../../ui/controls.js';
import { drawButton } from '../../ui/widgets.js';
import { ghost, flat } from '../../ui/styles.js';
import { draw as drawText, ellipsize, FONT } from '../../../game/core/text.js';
import { color, cssA } from '../../../game/core/theme.js';
import { darknet } from '../../../game/data/content.js';
import { MISSION_LABEL } from '../../../game/data/enums.js';
import { contractLabel } from '../../../game/state/contracts.js';
import { RECORD_LABEL, recordText } from '../../../game/state/gameState.js';
import { broker, haggleOf, snubbed } from '../../../game/state/haggle.js';
import { jobCards, across } from './cards.js';
import { NET, KIND_COLOR, UI_FONT, softAccent, netPrimary, netSolid, netDanger } from './theme.js';
import { HOME, MY_JOBS, links, money, pageHeader, heading, statTiles } from './shared.js';
import { dealPanel } from './deal.js';
import { maxJobs } from '../../../game/data/settings.js';
import { t as tl } from '../../../game/data/language.js';

/// The jobs on the open market: offered, from clients still dealing.
export function listings(game) {
  return game.contracts.filter((c) => c.state === 'offered' && !c.story && !snubbed(game, c.client));
}

/// The jobs the operator holds.
export function myJobs(game) {
  return game.contracts.filter((c) => c.state === 'accepted' || c.state === 'ready');
}

/// The company a job hits.
export function companyOf(game, c) {
  return game.world.hosts[c.target]?.company ?? null;
}

/// A list of jobs as cards, or a line saying there are none.
export const cardsOr = (game, jobs, none) => (jobs.length ? jobCards(game, jobs) : label(none, FONT.body, NET.dim));

/// The ways a list of jobs can be ordered.
const SORTS = [['fee', 'HIGHEST FEE'], ['time', 'TIME LEFT'], ['level', 'EASIEST']];

/// Jobs in the order the operator chose; the fee is the default.
function sorted(jobs, how) {
  const by = {
    fee: (a, b) => b.reward - a.reward,
    time: (a, b) => a.deadline - b.deadline,
    level: (a, b) => (a.difficulty ?? 1) - (b.difficulty ?? 1) || b.reward - a.reward,
  }[how] ?? ((a, b) => b.reward - a.reward);
  return [...jobs].sort(by);
}

/// The sort buttons: the chosen one lit.
const sortBar = (view) => buttons(SORTS.map(([key, text]) => ({
  id: `dsn.sort.${key}`, text, style: (view.sort ?? 'fee') === key ? netPrimary() : flat(),
})));

/// One chip per kind of work, with how many are open, each a way to its page.
function categoryChips(game) {
  const all = listings(game);
  return buttons(Object.entries(darknet().categories).map(([k, c]) => ({
    id: `dsn.go.cat/${k}`,
    text: `${c.name}  ${all.filter((j) => j.kind === k).length}`,
    style: { ...flat(), dark: { ...flat().dark, text: KIND_COLOR[k] } },
  })));
}

/// The brokers as tiles: their domain, their name and their pitch.
function brokerTiles(game) {
  const all = listings(game);
  const brokers = Object.entries(darknet().brokers);
  const TILE_H = 82;
  return Object.assign(custom((w) => Math.ceil(brokers.length / across(w)) * (TILE_H + 10) - 10, (ctx, sk, r, input, events, st) => {
    const n = across(r.w);
    const tw = Math.floor((r.w - 10 * (n - 1)) / n);
    brokers.forEach(([name, b], i) => {
      const t = { x: r.x + (i % n) * (tw + 10), y: r.y + Math.floor(i / n) * (TILE_H + 10), w: tw, h: TILE_H };
      const tint = softAccent(b.accent);
      const hot = st.hover === `dsn.go.${b.domain}`;
      ctx.fillStyle = color(hot ? sk.raised : sk.panel2);
      ctx.fillRect(t.x, t.y, t.w, t.h);
      ctx.strokeStyle = hot ? cssA(tint, 0.6) : color(sk.line);
      ctx.lineWidth = 1;
      ctx.strokeRect(t.x + 0.5, t.y + 0.5, t.w - 1, t.h - 1);
      ctx.fillStyle = cssA(tint, 0.9);
      ctx.fillRect(t.x, t.y, 2, t.h);
      if (drawButton(ctx, st, sk, `dsn.go.${b.domain}`, t, '', { ...flat(), tip: `${name}: ${b.tagline}` }, input)) events.push({ type: 'click', id: `dsn.go.${b.domain}` });
      const open = all.filter((j) => j.client === name).length;
      drawText(ctx, ellipsize(ctx, b.domain, FONT.emphasis, t.w - 70, UI_FONT), t.x + 14, t.y + 10, FONT.emphasis, color(tint), { family: UI_FONT });
      drawText(ctx, `${open} open`, t.x + t.w - 12, t.y + 11, FONT.body, color(open ? sk.text : sk.muted), { align: 'right' });
      drawText(ctx, ellipsize(ctx, name, FONT.body, t.w - 28, UI_FONT), t.x + 14, t.y + 34, FONT.body, color(sk.dim), { family: UI_FONT });
      drawText(ctx, ellipsize(ctx, b.tagline, FONT.body, t.w - 28, UI_FONT), t.x + 14, t.y + 56, FONT.body, color(sk.muted), { family: UI_FONT });
    });
  }), { ids: brokers.map(([, b]) => `dsn.go.${b.domain}`), dom: { type: 'brokers', game } });
}

/// The portal: figures, search, the newest and biggest work, the brokers.
export function hub(game, view) {
  const all = listings(game);
  const mine = myJobs(game);
  const waiting = game.contracts.filter((c) => haggleOf(game, c.id)?.state === 'waiting').length;
  const best = all.reduce((m, c) => Math.max(m, c.reward), 0);
  return {
    title: 'hub',
    accent: NET.accent,
    controls: [
      pageHeader({ path: 'dsn://hub', title: 'DSNET', sub: tl('windows.dsn.market.the_market_for_the'), accent: NET.accent, tag: `${all.length} OPEN` }),
      statTiles([
        { label: tl('windows.dsn.market.open_listings'), value: all.length },
        { label: tl('windows.dsn.market.your_jobs'), value: `${mine.length} / ${maxJobs()}`, tone: mine.length ? NET.ok : NET.text_hi },
        { label: tl('windows.dsn.market.replies_waiting'), value: waiting, tone: waiting ? NET.warn : NET.text_hi },
        { label: tl('windows.dsn.market.best_fee'), value: best ? money(best) : '-', tone: NET.warn },
      ]),
      spacer(12),
      field('dsn.search', view.query ?? '', 'search listings, brokers, companies'),
      buttons([{ id: 'dsn.search.go', text: tl('windows.dsn.market.search'), style: netPrimary() }]),
      ...(mine.length ? [heading(`YOUR JOBS // ${mine.length} OF ${maxJobs()}`), links([[MY_JOBS, `manage your ${mine.length} job${mine.length > 1 ? 's' : ''} → MY JOBS`]])] : []),
      heading(`ON THE MARKET // ${all.length} OPEN`),
      categoryChips(game),
      sortBar(view),
      spacer(6),
      cardsOr(game, sorted(all, view.sort), 'the market is quiet. come back in an hour.'),
      heading('BROKERS'),
      brokerTiles(game),
      heading('ELSEWHERE'),
      links([['board', 'the undernet board // rumours'], ['about', 'about this network']]),
      label('stay anonymous. bounce your route. never haggle for double.', FONT.body, NET.muted),
    ],
  };
}

/// One category: every listing of a kind.
export function category(game, kind, view = {}) {
  const cat = darknet().categories[kind];
  if (!cat) return null;
  const jobs = listings(game).filter((c) => c.kind === kind);
  return {
    title: cat.name.toLowerCase(),
    accent: KIND_COLOR[kind],
    controls: [
      pageHeader({ path: `dsn://cat/${kind}`, title: cat.name, sub: cat.blurb, accent: KIND_COLOR[kind] }),
      heading(`${jobs.length} OPEN`),
      sortBar(view),
      spacer(6),
      cardsOr(game, sorted(jobs, view.sort), 'no listings in this category right now'),
    ],
  };
}

/// A broker's own site: their header, their pitch, their listings.
export function brokerSite(game, name, about, view = {}) {
  const b = broker(name);
  const accent = softAccent(b.accent);
  const jobs = listings(game).filter((c) => c.client === name);
  const off = snubbed(game, name);
  const footer = label(`SIGNED // PGP 4096 // ESCROW 72H // ${b.domain}`, FONT.body, NET.muted);
  const head = pageHeader({ path: `dsn://${b.domain}${about ? '/about' : ''}`, title: name, sub: b.tagline, accent, tag: about ? 'ABOUT' : `${jobs.length} OPEN` });
  if (about) {
    const temper = b.temper > 1.1 ? 'STUBBORN' : b.temper < 0.95 ? 'FLEXIBLE' : 'FIRM';
    return {
      title: `${b.domain}/about`,
      accent,
      controls: [head, heading('ABOUT'), para(b.about), keyValue('HAGGLING', temper), links([[b.domain, '< their listings']]), footer],
    };
  }
  return {
    title: b.domain,
    accent,
    controls: [
      head,
      heading(off ? 'CLOSED TO YOU' : `LISTINGS // ${jobs.length}`),
      ...(off ? [para('You asked for too much. This broker is not dealing with you today.')] : [sortBar(view), spacer(6), cardsOr(game, sorted(jobs, view.sort), 'nothing posted right now')]),
      links([[`${b.domain}/about`, 'about us']]),
      footer,
    ],
  };
}

/// The email the job came in, once the job is taken: what to find, where, and what to do with it.
function briefing(game, c) {
  if (c.state === 'offered') return [];
  const m = game.mail.find((x) => x.contract === c.id);
  if (!m) return [];
  return [heading('THE EMAIL YOU GOT'), label(`from ${m.from.split('<')[0].trim()} // ${m.subject}`, FONT.body, NET.dim), para(m.body)];
}

/// A listing: the brief and the target on the left, the deal on the right.
export function job(game, id, view) {
  const c = game.contracts.find((x) => x.id === id);
  if (!c || c.story) return null;
  const b = broker(c.client);
  const coIdx = companyOf(game, c);
  const co = game.world.companies[coIdx];
  const h = game.world.hosts[c.target];
  const hours = Math.max(Math.floor((c.deadline - game.clock.minutes) / 60), 0);
  const kind = KIND_COLOR[c.kind];
  const left = [
    pageHeader({
      path: `dsn://job/${c.id}`,
      title: (c.title || contractLabel(c)).toUpperCase(),
      sub: `#${c.id} // ${MISSION_LABEL[c.kind]} // ${c.client}`,
      accent: kind,
    }),
    chips([[MISSION_LABEL[c.kind], kind], [`${hours}h LEFT`, hours < 6 ? NET.danger : NET.dim], [c.state === 'offered' ? 'OPEN' : c.state.toUpperCase(), c.state === 'offered' ? NET.ok : NET.warn]]),
    spacer(6),
    para(c.brief.replace(/[{}]/g, '')),
    ...briefing(game, c),
    heading('TARGET'),
    keyValue('COMPANY', co?.name ?? 'unknown'),
    keyValue('HOST', `${h?.name ?? ''} // ${h?.ip ?? ''}`),
    keyValue('SECURITY', `FW ${h?.firewall ?? 0} / MON ${h?.monitor ?? 0} / PX ${h?.proxy ?? 0}`),
    ...(c.file ? [keyValue('FILE', c.file)] : []),
    ...(c.record ? [keyValue('CHANGE', `${RECORD_LABEL[c.record.field]} → ${recordText(game, c.record.field, c.record.value)}`, NET.warn)] : []),
    buttons([{ id: `ct.track.${c.id}`, text: tl('windows.dsn.market.show_on_map'), style: ghost() }]),
    links([[`lookup/${coIdx}`, `LEAKBASE profile of ${co?.name ?? 'the target'}`], [b.domain, `more from ${c.client}`]]),
  ];
  const right = dealPanel(game, c, b, view);
  return { title: `job/${c.id}`, accent: kind, controls: [...left, ...right], columns: [left, right] };
}

/// The three steps of a job in hand.
const STEPS = ['ACCEPTED', 'READY', 'PAID'];

/// One job in hand: its title, the facts, where it stands and what can be done.
function jobRow(game, c, view) {
  const h = game.world.hosts[c.target];
  const linked = game.session?.target === c.target;
  const ready = c.state === 'ready';
  const hours = Math.max(Math.floor((c.deadline - game.clock.minutes) / 60), 0);
  const kind = KIND_COLOR[c.kind];
  const actions = [
    { id: `ct.submit.${c.id}`, text: tl('windows.dsn.market.submit_work'), style: { ...netSolid(), disabled: !ready } },
    { id: `ct.link.${c.id}`, text: linked ? 'LINK IS OPEN' : 'LINK NOW', style: { ...netPrimary(), disabled: linked || !!game.session } },
    { id: `ct.track.${c.id}`, text: tl('windows.dsn.market.show_on_map'), style: ghost() },
    { id: `dsn.drop.${c.id}`, text: view.dropArm === c.id ? 'SURE? DROP IT' : 'DROP', style: { ...netDanger(), disabled: !!c.tutorial && !!game.tutorial?.on, tip: c.tutorial && game.tutorial?.on ? 'The tutorial jobs cannot be dropped.' : undefined } },
  ];
  return Object.assign(custom((w) => (w >= 600 ? 138 : 182), (ctx, sk, r, input, events, st) => {
    ctx.fillStyle = color(sk.panel2);
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = color(sk.line);
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    ctx.fillStyle = cssA(kind, 0.9);
    ctx.fillRect(r.x, r.y, 2, r.h);
    const x = r.x + 16;
    const w = r.w - 32;
    const titleBox = { x, y: r.y + 8, w: w - 130, h: 26 };
    const title = `#${c.id}  ${(c.title || contractLabel(c)).toUpperCase()}`;
    // the whole title is the link; its text is drawn here so it sits at the left
    if (drawButton(ctx, st, sk, `dsn.go.job/${c.id}`, titleBox, '', { ...flat(), tip: tl('windows.dsn.market.open_this_listing') }, input)) {
      events.push({ type: 'click', id: `dsn.go.job/${c.id}` });
    }
    drawText(ctx, ellipsize(ctx, title, FONT.emphasis, titleBox.w - 8, UI_FONT), x, r.y + 12, FONT.emphasis, color(st.hover === `dsn.go.job/${c.id}` ? sk.accent : sk.text_hi), { family: UI_FONT });
    drawText(ctx, money(c.reward), r.x + r.w - 16, r.y + 12, FONT.emphasis, color(sk.warn), { align: 'right' });
    drawText(ctx, ellipsize(ctx, `${h?.name ?? ''} (${h?.ip ?? ''})  //  ${hours}h left  //  ${c.client}`, FONT.body, w, UI_FONT), x, r.y + 42, FONT.body, color(sk.dim), { family: UI_FONT });
    // where the job stands: three steps, the current one lit
    const at = ready ? 1 : 0;
    STEPS.forEach((text, i) => {
      const sx = x + i * 110;
      ctx.fillStyle = i <= at ? cssA(i === at ? (ready ? sk.ok : sk.warn) : sk.dim, 0.9) : color(sk.line_hi);
      ctx.fillRect(sx, r.y + 72, 100, 3);
      drawText(ctx, text, sx, r.y + 78, FONT.body, color(i === at ? sk.text_hi : sk.muted));
    });
    const narrow = r.w < 600;
    const per = narrow ? 2 : 4;
    const bw = Math.floor((w - 8 * (per - 1)) / per);
    actions.forEach((a, i) => {
      const rr = { x: x + (i % per) * (bw + 8), y: r.y + r.h - (narrow ? 82 : 40) + Math.floor(i / per) * 38, w: bw, h: 30 };
      if (drawButton(ctx, st, sk, a.id, rr, a.text, a.style, input)) events.push({ type: 'click', id: a.id });
    });
  }), { dom: { type: 'jobrow', game, c, actions, linked, ready, hours, h } });
}

/// MY JOBS: the work in hand, the deals being talked over, and the history.
export function jobsPage(game, view) {
  const mine = myJobs(game);
  const talking = game.contracts.filter((c) => c.state === 'offered' && haggleOf(game, c.id) && ['waiting', 'counter'].includes(haggleOf(game, c.id).state));
  const past = game.contracts.filter((c) => ['done', 'paid', 'failed', 'expired'].includes(c.state)).slice(-12).reverse();
  const out = [heading(`IN PROGRESS // ${mine.length} OF ${maxJobs()}`)];
  if (!mine.length) out.push(label('no jobs in hand // pick one from the market', FONT.body, NET.dim), links([[HOME, 'browse the market']]));
  mine.forEach((c) => out.push(jobRow(game, c, view), spacer(10)));
  out.push(heading(`NEGOTIATING // ${talking.length}`));
  if (!talking.length) out.push(label('no deals waiting on a reply', FONT.body, NET.dim));
  talking.forEach((c) => out.push(links([[`job/${c.id}`, `#${c.id} ${c.client} // ${haggleOf(game, c.id).state === 'counter' ? `counter-offer ${money(haggleOf(game, c.id).counter)}` : 'waiting for a reply'}`]])));
  out.push(heading('HISTORY'));
  if (!past.length) out.push(label('nothing yet', FONT.body, NET.dim));
  past.forEach((c) => out.push(label(`#${c.id}  ${pad(c.state.toUpperCase(), 9)} ${money(c.reward)} // ${contractLabel(c)} // ${c.client}`, FONT.body, c.state === 'failed' || c.state === 'expired' ? NET.danger : NET.dim)));
  return {
    title: 'my jobs',
    accent: NET.ok,
    controls: [
      pageHeader({ path: 'dsn://jobs', title: 'My jobs', sub: tl('windows.dsn.market.your_work_your_deals'), accent: NET.ok, tag: `${mine.length} OF ${maxJobs()}` }),
      statTiles([
        { label: tl('windows.dsn.market.in_progress'), value: `${mine.length} / ${maxJobs()}` },
        { label: tl('windows.dsn.market.ready_to_hand_in'), value: mine.filter((c) => c.state === 'ready').length, tone: NET.ok },
        { label: tl('windows.dsn.market.negotiating'), value: talking.length, tone: talking.length ? NET.warn : NET.text_hi },
        { label: tl('windows.dsn.market.done'), value: past.filter((c) => c.state === 'done' || c.state === 'paid').length },
      ]),
      ...out,
    ],
  };
}

export const pad = (s, n) => String(s).padEnd(n);
