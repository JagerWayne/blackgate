// The actions a link can carry out on the host itself: the bypasses, the
// network tools and the wipe of the logs. The names and the words that say why
// one of them cannot run come from the data folder, one file per action. They
// are offered in the menu of a right click on the host's name, and only the
// apps that are installed are listed.

import { sessionActions, hint } from '../../game/data/content.js';
import { toolLevel } from '../../game/state/gameState.js';
import { taskError } from '../../game/systems/sessionTasks.js';

/// The order the actions are listed in.
const ORDER = ['BypassFirewall', 'BypassMonitor', 'BypassProxy', 'Ddos', 'MapNetwork', 'ProbeIam', 'EscalateKernel', 'WipeLogs', 'ModifyLogs'];

/// The items of the host menu: each installed action, greyed with the reason
/// when it cannot run now. `sess.task.<kind>` is the click each sends.
export function hostMenu(game, s) {
  const rank = (k) => (ORDER.includes(k) ? ORDER.indexOf(k) : ORDER.length);
  const items = sessionActions()
    .filter((sp) => toolLevel(game, sp.tool) > 0)
    .sort((a, b) => rank(a.kind) - rank(b.kind))
    .map((spec) => ({ id: `sess.task.${spec.kind}`, text: spec.label, why: whyNot(game, s, spec) || undefined }));
  return items.length ? items : [{ text: 'no apps installed: get them in the App Store' }];
}

/// The warning lines of a sabotage job: every action leaves a log, so the host
/// has to end clean.
export function sabotageNotes(game, s) {
  if (!sabotageOn(game, s)) return [];
  return [{ text: hint('destroyWarning'), tone: 'danger' }, { text: hint('destroyOrder'), tone: 'warn' }];
}

/// Is a sabotage job live on the host this link is on?
function sabotageOn(game, s) {
  return game.contracts.some((c) => (c.state === 'accepted' || c.state === 'ready')
    && c.kind === 'destroy' && c.target === s.target);
}

/// Why an action cannot run right now, or '' when it can.
function whyNot(game, s, spec) {
  const h = game.world.hosts[s.target];
  if (!h) return 'no such host';
  const lvl = toolLevel(game, spec.tool);
  const r = spec.reasons ?? {};
  switch (spec.kind) {
    case 'BypassFirewall':
      if (!h.firewall) return r.none ?? '';
      if (lvl === 0) return r.noTool ?? '';
      if (lvl < h.firewall) return r.weak ?? '';
      if (s.fwBypassed) return r.done ?? '';
      return '';
    case 'BypassMonitor':
      if (!h.monitor) return r.none ?? '';
      if (lvl === 0) return r.noTool ?? '';
      if (lvl < h.monitor) return r.weak ?? '';
      if (s.monBypassed) return r.done ?? '';
      return '';
    case 'BypassProxy':
      if (!h.proxy) return r.none ?? '';
      if (lvl === 0) return r.noTool ?? '';
      if (lvl < h.proxy) return r.weak ?? '';
      if (s.proxyBypassed) return r.done ?? '';
      return '';
    case 'MapNetwork':
    case 'ProbeIam':
    case 'EscalateKernel':
      if (lvl === 0) return r.noTool ?? '';
      return taskError(game, s, spec.kind) ?? '';
    case 'Ddos': {
      const fw = h.firewall > 0 && !s.fwBypassed;
      const px = h.proxy > 0 && !s.proxyBypassed;
      if (!h.firewall && !h.proxy) return r.none ?? '';
      if (lvl === 0) return r.noTool ?? '';
      if (!fw && !px) return r.done ?? '';
      if ((fw && lvl < h.firewall) || (px && lvl < h.proxy)) return r.weak ?? '';
      return '';
    }
    case 'WipeLogs':
      if (lvl === 0) return r.noTool ?? '';
      if (!h.logs.length) return r.none ?? '';
      return '';
    case 'ModifyLogs':
      if (lvl === 0) return r.noTool ?? '';
      if (!h.logs.some((l) => l.ip === game.player.gateway.ip)) return r.none ?? '';
      return '';
    default:
      return '';
  }
}
