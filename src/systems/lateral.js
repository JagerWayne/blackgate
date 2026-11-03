// Moving inside a company's network: a forged ticket takes the live session to
// another host of the same company without a new route.

import { pushLine } from '../state/session.js';
import { discover } from '../state/gameHelpers.js';
import { exfilWindow } from '../state/transfer.js';
import { dropTokens } from './tokens.js';

/// Moves the live link to another host. The host it leaves becomes a hop of the
/// route (its logs still count as heat on leaving), the firewall and the proxy
/// are behind you inside the network, the monitor is not, and the trace goes along.
export function moveSession(game, hostId) {
  const s = game.session;
  const from = s.target;
  const to = game.world.hosts[hostId];
  dropTokens(game, from);
  if (!s.route.includes(from)) s.route = [...s.route, from];
  s.target = hostId;
  s.tab = 0;
  s.selService = null;
  s.selFile = null;
  s.fwBypassed = true;
  s.proxyBypassed = true;
  s.monBypassed = false;
  delete s.windowLeft;
  const window = exfilWindow(to);
  if (window !== null) s.windowLeft = window;
  discover(game, hostId);
  to.logs.push({ minute: game.clock.minutes, ip: game.player.gateway.ip, text: 'session open', loud: false });
  to.firstVisit ??= game.clock.minutes;
  to.lastVisit = game.clock.minutes;
  pushLine(s, `ticket accepted // moved to ${to.name} (${to.ip})`);
  if (to.monitor > 0) pushLine(s, 'warning: intrusion monitor active');
  if (window !== null) pushLine(s, `warning: the host drops sessions after ${window}s`);
}
