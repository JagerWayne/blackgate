// How a lock is guarded beyond its password: nothing, app MFA, session-bound
// MFA, or a hardware token. Pure rules over the world, so the generator and a
// loaded old save agree (no random draws).

/// The guards, weakest first, and how strong a Session Token Hijacker has to be
/// to beat each (a hardware token is opened with the HSM tap instead).
export const AUTH_LEVEL = { password: 0, mfa: 1, session: 2, token: 3 };

/// What the window calls each.
export const AUTH_LABEL = { password: 'PASSWORD', mfa: 'APP MFA', session: 'SESSION-BOUND MFA', token: 'HARDWARE TOKEN' };

/// The seconds a captured session token stays good.
export const TOKEN_SECS = 40;

/// The kinds of lock that sit behind it. The web, mail and proxy services keep a
/// bare password and a voice lock has its own check.
const GUARDED = new Set(['admin', 'records', 'bank', 'db', 'ai']);

/// The host difficulty (the three guards added) from which a lock is app MFA,
/// session-bound MFA, and (banks and ministries only) a hardware token.
const MFA_FROM = 4;
const SESSION_FROM = 7;
const TOKEN_FROM = 9;

/// The guard on a service; a service from before MFA has a password only.
export function authOf(svc) { return svc.auth ?? 'password'; }

/// The guard a lock of a host gets from the host's difficulty.
export function authFor(host, svc) {
  if (!GUARDED.has(svc.kind) || !svc.password) return 'password';
  const d = host.firewall + host.monitor + host.proxy;
  if (d >= TOKEN_FROM && (host.kind === 'bank' || host.kind === 'gov')) return 'token';
  if (d >= SESSION_FROM) return 'session';
  return d >= MFA_FROM ? 'mfa' : 'password';
}

/// Gives every service of a host the guard it should have, keeping any it has.
export function assignAuth(host) {
  host.services.forEach((v) => { v.auth ??= authFor(host, v); });
}

/// The guard on the way into a company's mail: its front host's admin login.
export function inboxAuth(world, company) {
  const front = world.hosts[world.companies[company]?.hosts?.[0]];
  const admin = front?.services.find((v) => v.kind === 'admin');
  return admin ? authOf(admin) : 'password';
}

/// The hijacker version a guard asks for (a token host's inbox is read with the best).
export function hijackerLevel(auth) { return Math.min(AUTH_LEVEL[auth], 2); }
