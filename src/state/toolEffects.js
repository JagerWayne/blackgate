// What a version of a tool does, in words, read from the rules the tasks
// apply (src/systems/sessionTasks.js). A tool whose level the tasks do not
// read says so, rather than promising something it does not do.

/// The tools a task reads the level of, and what the level buys.
const BY_LEVEL = {
  PasswordCracker: (v) => `beats locks up to v${v}`,
  FirewallBypass: (v) => `gets past firewalls up to FW ${v}`,
  ProxyBypass: (v) => `scrubs proxies up to PX ${v}`,
  MonitorBypass: (v) => `blinds monitors up to strength ${v}`,
  SessionHijacker: (v) => (v >= 2 ? 'beats app MFA and session-bound MFA' : 'beats app MFA'),
  DdosCannon: (v) => `drops firewalls up to FW ${v} and proxies up to PX ${v} at once, loudly`,
  Decrypter: (v) => `opens files encrypted up to v${v}`,
  TraceTracker: (v) => `warns of a trace ${5 * v}% earlier`,
  VoiceAnalyser: (v) => `records voices and matches voice locks up to v${v}`,
  OsintSweep: (v) => ['PROFILE finds email and role', 'PROFILE finds the phone too', 'PROFILE finds the social handle too', 'PROFILE finds leaked passwords too', 'PROFILE finds leaked passwords too'][Math.min(v, 5) - 1],
  SpoofKit: (v) => (v >= 2 ? 'spoofed calls, phishing, spam and phone taps' : 'spoofed calls, phishing and spam; taps need v2'),
  CredentialStuff: () => "opens an inbox with its owner's leaked password",
};

/// The tools a task needs installed, at any version.
const ANY_LEVEL = new Set(['FileCopier', 'FileDeleter', 'LogDeleter', 'LogModifier']);

/// What a tool no task uses says: the shop will not sell it.
export const NO_TASK = 'no task uses this tool yet';

/// What one version of a tool does.
export function versionEffect(kind, level) {
  if (BY_LEVEL[kind]) return BY_LEVEL[kind](level);
  if (ANY_LEVEL.has(kind)) return 'does the whole job';
  return NO_TASK;
}
