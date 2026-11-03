// What the HUD programs put on the screen: the attack surface, the route and the
// company graph. Each is null until its program is installed.

import { toolLevel } from './gameState.js';
import { exfilWindow } from './transfer.js';
import { authOf, AUTH_LABEL } from '../data/auth.js';
import { difficultyOf, isInternal } from '../data/network.js';

/// The target's surface in one line (SOC ATTACK SURFACE HUD).
export function surfaceText(game, s) {
  if (!toolLevel(game, 'AttackSurfaceHud')) return null;
  const h = game.world.hosts[s.target];
  const window = exfilWindow(h);
  const guards = [...new Set(h.services.map((v) => authOf(v)).filter((a) => a !== 'password').map((a) => AUTH_LABEL[a]))];
  return `FW ${h.firewall} // MON ${h.monitor} // PX ${h.proxy} // DIFFICULTY ${difficultyOf(h)}`
    + `${window === null ? '' : ` // WINDOW ${window}s`}${guards.length ? ` // ${guards.join(', ')}` : ''}`;
}

/// The route of the link, hop by hop (HOP VISUALIZER).
export function routeText(game, s) {
  if (!toolLevel(game, 'HopVisualizer')) return null;
  const name = (id) => game.world.hosts[id]?.name ?? '?';
  return `ROUTE: you → ${[...s.route, s.target].map(name).join(' → ')}`;
}

/// The segments of the linked company that are on the map (CLOUD GRAPH).
export function graphNodes(game, s) {
  if (!toolLevel(game, 'CloudGraphHud')) return null;
  const company = game.world.hosts[s.target].company;
  const hosts = game.world.companies[company]?.hosts ?? [];
  return hosts
    .map((id) => game.world.hosts[id])
    .filter((h) => h.discovered)
    .map((h) => ({ id: h.id, name: h.name, ip: h.ip, internal: isInternal(h), difficulty: difficultyOf(h), here: h.id === s.target }));
}
