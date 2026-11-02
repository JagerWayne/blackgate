// The game's version, shown on the login screen. It must match package.json
// (a test checks), which is what a release is built and tagged from.

export const VERSION = '0.6.0';

const SEEN = 'blackgate.seen-version';

/// The full build id in the Windows app ('0.6.0+20261102T…'), or the version.
export function buildText() {
  return globalThis.blackgate?.build?.() ?? VERSION;
}

/// The version this terminal ran before this one, then remembers this one.
/// Returns the older version once, right after an update, and null otherwise.
export function justUpdated(store = globalThis.blackgate?.store ?? globalThis.localStorage) {
  try {
    const seen = store?.getItem(SEEN) ?? null;
    if (seen === VERSION) return null;
    store?.setItem(SEEN, VERSION);
    return seen;
  } catch {
    return null;
  }
}
