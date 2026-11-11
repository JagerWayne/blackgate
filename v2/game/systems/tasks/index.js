// Session tasks that carry their own plan and completion. A kind missing here
// is handled by the switch in sessionTasks.js and sessionComplete.js.
// Shape: { KIND: { plan(game, s, h, arg), done(game, s, task, h), tool, unique } }

import { pushLine } from '../../state/session.js';
import { toolLevel } from '../../state/gameState.js';

export const TASKS = {
  BypassFirewall: {
    tool: 'FirewallBypass',
    plan(game, s, h) {
      if (toolLevel(game, 'FirewallBypass') < h.firewall) return { error: 'firewall bypass too weak' };
      if (s.fwBypassed) return { error: 'firewall already bypassed' };
      return { label: 'bypass firewall', dur: 2.5 + h.firewall * 1.6, loud: false };
    },
    done(game, s) {
      s.fwBypassed = true;
      pushLine(s, 'firewall bypassed');
    },
  },
  BypassMonitor: {
    tool: 'MonitorBypass',
    plan(game, s, h) {
      if (toolLevel(game, 'MonitorBypass') < h.monitor) return { error: 'monitor bypass too weak' };
      if (s.monBypassed) return { error: 'monitor already blinded' };
      return { label: 'blind monitor', dur: 3.5 + h.monitor * 1.2, loud: false };
    },
    done(game, s) {
      s.monBypassed = true;
      pushLine(s, 'monitor blinded // trace starved');
    },
  },
};
