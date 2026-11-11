// What a version of a tool does, in words, read from the rules the tasks
// apply (src/systems/sessionTasks.js). A tool whose level the tasks do not
// read says so, rather than promising something it does not do.

import { REACH } from '../data/network.js';
import { software } from '../data/content.js';

/// The plain name of a tool, from the catalogue.
export function toolName(kind) {
  return software().find((d) => d.kind === kind)?.name ?? kind;
}

/// The tools a task reads the level of, and what the level buys.
const BY_LEVEL = {
  PasswordCracker: (v) => `opens locks up to strength ${v}`,
  FirewallBypass: (v) => `gets past firewalls up to rating ${v}`,
  ProxyBypass: (v) => `clears relays up to rating ${v}`,
  MonitorBypass: (v) => `silences monitors up to strength ${v}`,
  ZeroTrustMapper: (v) => `finds company machines up to difficulty ${REACH[v]}`,
  KerberosForger: (v) => `moves you to company machines up to difficulty ${REACH[v]}`,
  IamProbe: (v) => ['opens one locked password service with a stolen key', 'also opens services that ask for a code', 'also opens services tied to a login session'][v - 1],
  KernelPrivesc: (v) => ['takes control: opens every password lock', 'also opens services that ask for a code', 'also opens services tied to a login session'][v - 1] + ', and always raises the alarm',
  AttackSurfaceHud: () => "shows the target's defences in the link panel",
  HopVisualizer: () => 'draws your route machine by machine',
  CloudGraphHud: () => 'opens the company map',
  SessionHijacker: (v) => (v >= 2 ? 'beats code checks and login-session checks' : 'beats code checks'),
  DdosCannon: (v) => `knocks down firewalls up to ${v} and relays up to ${v} at once, loudly`,
  Decrypter: (v) => `unlocks files scrambled up to level ${v}`,
  TraceTracker: (v) => `warns of a trace ${5 * v}% earlier`,
  VoiceAnalyser: (v) => `copies voices and opens voice locks up to strength ${v}`,
  OsintSweep: (v) => ['finds email and job title', 'finds the phone number too', 'finds the social media account too', 'finds leaked passwords too', 'finds leaked passwords too'][Math.min(v, 5) - 1],
  SpoofKit: (v) => (v >= 2 ? 'spoofed calls, phishing, spam and phone taps' : 'spoofed calls, phishing and spam; phone taps need the advanced version'),
  CredentialStuff: () => "opens an inbox using its owner's leaked password",
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
