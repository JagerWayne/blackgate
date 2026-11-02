import { label, para, keyValue, buttons, field, chips, spacer } from '../../ui/controls.js';
import { ghost } from '../../ui/styles.js';
import { darknet } from '../../data/content.js';
import { MISSION_LABEL } from '../../data/enums.js';
import { contractLabel } from '../../state/contracts.js';
import { RECORD_LABEL, recordText } from '../../state/gameState.js';
import { broker, haggleOf, snubbed } from '../../state/haggle.js';
import { jobCards } from './cards.js';
import { KIND_COLOR, hexOf, netPrimary, netSolid, netDanger } from './theme.js';
import { HOME, MY_JOBS, MAX_JOBS, link, links, money, banner, heading } from './shared.js';
import { dealPanel } from './deal.js';

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
export const cardsOr = (game, jobs, none) => (jobs.length ? jobCards(game, jobs) : label(none, 10.5));

/// The portal: search, the newest and biggest work, the brokers.
export function hub(game, view) {
  const all = listings(game);
  const top = [...all].sort((a, b) => b.reward - a.reward);
  const mine = myJobs(game);
  return {
    title: 'hub',
    accent: 0x7fd4ff,
    controls: [
      banner([
        ' ____  ____  _   _ _____ _____ ',
        '|  _ \\/ ___|| \\ | | ____|_   _|',
        '| | | \\___ \\|  \\| |  _|   | |  ',
        '| |_| |___) | |\\  | |___  | |  ',
        '|____/|____/|_| \\_|_____| |_|  ',
        '   THE MARKET FOR THE ANONYMOUS',
      ], '#7fd4ff'),
      field('dsn.search', view.query ?? '', 'search listings, brokers, companies'),
      buttons([{ id: 'dsn.search.go', text: 'SEARCH', style: netPrimary() }]),
      ...(mine.length ? [heading(`YOUR JOBS // ${mine.length} OF ${MAX_JOBS}`), links([[MY_JOBS, `manage your ${mine.length} job${mine.length > 1 ? 's' : ''} → MY JOBS`]])] : []),
      heading(`ON THE MARKET // ${all.length} OPEN`),
      cardsOr(game, top, 'the market is quiet. come back in an hour.'),
      heading('BROKERS'),
      ...Object.entries(darknet().brokers).flatMap(([name, b]) => [
        links([[b.domain, `${b.domain}  // ${name}`]]),
        label(b.tagline, 10, hexOf(b.accent)),
      ]),
      heading('ELSEWHERE'),
      links([['board', 'the undernet board // rumours'], ['about', 'about this network']]),
      label('stay anonymous. bounce your route. never haggle for double.', 9.5, 0x5d6b88),
    ],
  };
}

/// One category: every listing of a kind.
export function category(game, kind) {
  const cat = darknet().categories[kind];
  if (!cat) return null;
  const jobs = listings(game).filter((c) => c.kind === kind);
  return {
    title: cat.name.toLowerCase(),
    accent: KIND_COLOR[kind],
    controls: [
      banner([`// ${cat.name}`, `   ${cat.blurb}`], KIND_COLOR[kind]),
      heading(`${jobs.length} OPEN`),
      cardsOr(game, jobs, 'no listings in this category right now'),
    ],
  };
}

/// A broker's own site: their banner, their pitch, their listings.
export function brokerSite(game, name, about) {
  const b = broker(name);
  const accent = hexOf(b.accent);
  const jobs = listings(game).filter((c) => c.client === name);
  const off = snubbed(game, name);
  const footer = label(`SIGNED // PGP 4096 // ESCROW 72H // ${b.domain}`, 9, 0x5d6b88);
  const base = [banner(b.banner, b.accent), label(b.tagline, 11, accent)];
  if (about) {
    const temper = b.temper > 1.1 ? 'STUBBORN' : b.temper < 0.95 ? 'FLEXIBLE' : 'FIRM';
    return {
      title: `${b.domain}/about`,
      accent,
      controls: [...base, heading('ABOUT'), para(b.about), keyValue('HAGGLING', temper), links([[b.domain, '< their listings']]), footer],
    };
  }
  return {
    title: b.domain,
    accent,
    controls: [
      ...base,
      heading(off ? 'CLOSED TO YOU' : `LISTINGS // ${jobs.length}`),
      off ? para('You asked for too much. This broker is not dealing with you today.') : cardsOr(game, jobs, 'nothing posted right now'),
      links([[`${b.domain}/about`, 'about us']]),
      footer,
    ],
  };
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
    banner([`#${c.id} // ${(c.title || contractLabel(c)).toUpperCase()}`], kind),
    chips([[MISSION_LABEL[c.kind], kind], [`${hours}h LEFT`, hours < 6 ? 0xff6b6b : 0x8c9cb8], [c.state === 'offered' ? 'OPEN' : c.state.toUpperCase(), c.state === 'offered' ? 0x5be49b : 0xffc857]]),
    para(c.brief.replace(/[{}]/g, '')),
    heading('TARGET'),
    keyValue('COMPANY', co?.name ?? 'unknown'),
    keyValue('HOST', `${h?.name ?? ''} // ${h?.ip ?? ''}`),
    keyValue('SECURITY', `FW ${h?.firewall ?? 0} / MON ${h?.monitor ?? 0} / PX ${h?.proxy ?? 0}`),
    ...(c.file ? [keyValue('FILE', c.file)] : []),
    ...(c.record ? [keyValue('CHANGE', `${RECORD_LABEL[c.record.field]} → ${recordText(game, c.record.field, c.record.value)}`, 0xffc857)] : []),
    buttons([{ id: `ct.track.${c.id}`, text: 'SHOW ON MAP', style: ghost() }]),
    links([[`lookup/${coIdx}`, `LEAKBASE profile of ${co?.name ?? 'the target'}`], [b.domain, `more from ${c.client}`]]),
  ];
  const right = dealPanel(game, c, b, view);
  return { title: `job/${c.id}`, accent: kind, controls: [...left, ...right], columns: [left, right] };
}

/// MY JOBS: the work in hand, the deals being talked over, and the history.
export function jobsPage(game, view) {
  const mine = myJobs(game);
  const talking = game.contracts.filter((c) => c.state === 'offered' && haggleOf(game, c.id) && ['waiting', 'counter'].includes(haggleOf(game, c.id).state));
  const past = game.contracts.filter((c) => ['done', 'paid', 'failed', 'expired'].includes(c.state)).slice(-12).reverse();
  const out = [heading(`IN PROGRESS // ${mine.length} OF ${MAX_JOBS}`)];
  if (!mine.length) out.push(label('no jobs in hand // pick one from the market', 10.5), links([[HOME, 'browse the market']]));
  mine.forEach((c) => {
    const h = game.world.hosts[c.target];
    const linked = game.session?.target === c.target;
    const ready = c.state === 'ready';
    const hours = Math.max(Math.floor((c.deadline - game.clock.minutes) / 60), 0);
    out.push(
      links([[`job/${c.id}`, `#${c.id}  ${(c.title || contractLabel(c)).toUpperCase()}`]]),
      label(`${money(c.reward)} // ${h?.name ?? ''} (${h?.ip ?? ''}) // ${hours}h left // ${c.client}`, 10),
      chips([[ready ? 'READY TO SUBMIT' : 'WORK NOT DONE', ready ? 0x5be49b : 0xffc857]]),
      buttons([
        { id: `ct.submit.${c.id}`, text: 'SUBMIT WORK', style: { ...netSolid(), disabled: !ready } },
        { id: `ct.link.${c.id}`, text: linked ? 'LINK IS OPEN' : 'LINK NOW', style: { ...netPrimary(), disabled: linked || !!game.session } },
        { id: `ct.track.${c.id}`, text: 'SHOW ON MAP', style: ghost() },
        { id: `dsn.drop.${c.id}`, text: view.dropArm === c.id ? 'SURE? DROP IT' : 'DROP', style: netDanger() },
      ]),
      spacer(8),
    );
  });
  out.push(heading(`NEGOTIATING // ${talking.length}`));
  if (!talking.length) out.push(label('no deals waiting on a reply', 10));
  talking.forEach((c) => out.push(links([[`job/${c.id}`, `#${c.id} ${c.client} // ${haggleOf(game, c.id).state === 'counter' ? `counter-offer ${money(haggleOf(game, c.id).counter)}` : 'waiting for a reply'}`]])));
  out.push(heading('HISTORY'));
  if (!past.length) out.push(label('nothing yet', 10));
  past.forEach((c) => out.push(label(`#${c.id}  ${pad(c.state.toUpperCase(), 9)} ${money(c.reward)} // ${contractLabel(c)} // ${c.client}`, 10, c.state === 'failed' || c.state === 'expired' ? 0xff6b6b : 0x8c9cb8)));
  return { title: 'my jobs', accent: 0x5be49b, controls: [banner(['// MY JOBS', '   your work, your deals, your record'], '#5be49b'), ...out] };
}

export const pad = (s, n) => String(s).padEnd(n);
