// The pages of DSNET, built from the game each frame. A page is a title,
// an accent colour and a list of the shell's own form controls (a link is a
// flat button whose id carries the address it goes to). A page may also give
// two columns, which a wide browser shows side by side.


import { para } from '../../ui/controls.js';
import { darknet } from '../../data/content.js';
import { broker } from '../../state/haggle.js';
import { sleekPage } from './sleek.js';
import { companyPage, directoryPage } from './company.js';
import { companyAt } from '../../state/sites.js';
import { HOME, MY_JOBS, link, links, banner } from './shared.js';
import { hub, category, brokerSite, job, jobsPage } from './market.js';
import { lookup, board, search, about, startPage } from './network.js';
export { HOME, MY_JOBS } from './shared.js';
export { listings, myJobs } from './market.js';

/// The browser's own start page: where a new tab opens.
export const START = 'start';
/// An address without its scheme, trimmed and lower case.
export function normalize(url) {
  const u = String(url ?? '').trim().replace(/^(dsn|https?):\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '').toLowerCase() || START;
  // the friendly names of the two sites
  if (u === 'dsnet' || u === 'dsnet.onion') return HOME;
  return u.replace(/^sleekpages\.com/, 'sleekpages');
}
/// A link: a flat button in the accent colour that goes to an address.
/// The broker whose site lives at a domain, or null.
function brokerAt(game, domain) {
  const named = Object.keys(darknet().brokers).find((n) => darknet().brokers[n].domain === domain);
  return named ?? game.contracts.map((c) => c.client).find((n) => broker(n).domain === domain) ?? null;
}
/// The page for an address, or a 404.
export function buildPage(game, url, view = {}) {
  const u = normalize(url);
  const head = u.split('/')[0];
  const rest = u.split('/').slice(1).join('/');
  let page = null;
  if (u === START) page = startPage();
  else if (head === 'sleekpages') page = sleekPage(game, rest, view);
  else if (u === 'directory') page = directoryPage(game);
  else if (companyAt(game, head) >= 0) page = companyPage(game, companyAt(game, head), rest);
  else if (u === HOME) page = hub(game, view);
  else if (u === MY_JOBS) page = jobsPage(game, view);
  else if (head === 'cat') page = category(game, rest);
  else if (head === 'job') page = job(game, Number(rest), view);
  else if (head === 'lookup') page = lookup(game, Number(rest));
  else if (u === 'board') page = board(game);
  else if (u === 'about') page = about();
  else if (head === 'search') page = search(game, decodeURIComponent(rest));
  else {
    const name = brokerAt(game, head);
    if (name) page = brokerSite(game, name, rest === 'about');
  }
  if (page) return { ...page, url: u };
  const lines = darknet().notFound;
  return {
    url: u,
    title: '404',
    accent: 0xff6b6b,
    controls: [banner(['404'], '#ff6b6b'), para(lines[u.length % lines.length]), links([[HOME, 'back to the hub']])],
  };
}
