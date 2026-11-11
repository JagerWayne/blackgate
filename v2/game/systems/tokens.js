// Captured session tokens: a hijacked MFA service stays open only as long as
// its token lives, and a token that dies is heard by the host.

import { pushLine } from '../state/session.js';

/// How much a dead token adds to the trace.
const DEAD_TOKEN_TRACE = 0.1;

/// Counts down the tokens on the linked host. One that runs out locks its
/// service again; the work that needed the lock is lost and the trace starts.
export function tokenTick(game, s, dt) {
  game.world.hosts[s.target].services.forEach((svc) => {
    if (svc.tokenLeft === undefined) return;
    svc.tokenLeft -= dt;
    if (svc.tokenLeft > 0) return;
    svc.open = false;
    delete svc.tokenLeft;
    if (svc.kind === 'records') s.tasks = s.tasks.filter((t) => t.kind !== 'AlterRecord');
    s.alerted = true;
    s.trace = Math.min(s.trace + DEAD_TOKEN_TRACE, 1);
    pushLine(s, `session token expired // ${svc.name}:${svc.port} locked // the host noticed`);
    game.toasts.push({ text: 'Session token expired: the host noticed', kind: 'bad', born: game.uiTime });
  });
}

/// The tokens go with the link: the services they opened lock again.
export function dropTokens(game, hostId) {
  game.world.hosts[hostId].services.forEach((svc) => {
    if (svc.tokenLeft === undefined) return;
    svc.open = false;
    delete svc.tokenLeft;
  });
}
