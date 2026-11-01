// The colour a host's guard is drawn in: a wide-open host is safe, a watched
// one is not. Every window that shows the guard reads it from here.

/// The tint the guard of a host is drawn in.
export function guardTint(sk, h) {
  if (!h) return sk.dim;
  if (!h.firewall && !h.monitor && !h.proxy) return sk.ok;
  if (h.monitor >= 4) return sk.danger;
  return sk.warn;
}
