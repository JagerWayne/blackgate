// The Bazaar (sell stolen files), PasteDump (leaks) and archive.nx (old snapshots of company sites). Each is a site of its own,
// drawn by app/apps/dsnWeb.js from one `dom` block, and asks the browser for no side panel (site: 'web').

import { custom } from '../../ui/controls.js';
import { pastesOf } from '../../../game/state/bazaar.js';

const D = (game, type, extra = {}) => Object.assign(custom(40, () => {}), { dom: { type, game, ...extra } });

/// bazaar.nx: your copied files and what a buyer pays for each. A buyer is sometimes a sting.
export function bazaarPage(game) {
  return { title: 'bazaar.nx', site: 'web', bg: '#120e08', accent: 0xe0a030, controls: [D(game, 'bz-page')] };
}

/// pastedump.nx: today's leaks. A leaked email goes on file with a click; a server name is for the Command Prompt.
export function pasteDumpPage(game) {
  return { title: 'pastedump.nx', site: 'web', bg: '#0d1117', accent: 0xf85149, controls: [D(game, 'pd-page', { pastes: pastesOf(game) })] };
}

/// archive.nx: the list of saved sites, and a company's old snapshots (`<company>` or `<company>/<snapshot>`).
export function archivePage(game, rest) {
  const base = { site: 'web', bg: '#f6f1e4', accent: 0x7a1f1f };
  if (!rest) return { title: 'archive.nx', ...base, controls: [D(game, 'ar-home')] };
  const [a, b] = rest.split('/');
  const ci = Number(a);
  const c = game.world.companies[ci];
  if (!Number.isInteger(ci) || !c) return null;
  return { title: `archive.nx/${c.short.toLowerCase()}`, ...base, controls: [D(game, 'ar-snap', { ci, at: b === undefined ? undefined : Number(b) })] };
}
