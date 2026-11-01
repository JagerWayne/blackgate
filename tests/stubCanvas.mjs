// A 2D context that draws nothing and remembers where text went, so the
// renderers can run under node. Every glyph is 7 px wide.

export function stubCtx() {
  const texts = [];
  const fills = [];
  const ctx = new Proxy({}, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'texts') return texts;
      if (k === 'measureText') return (s) => ({ width: String(s).length * 7 });
      if (k === 'fills') return fills;
      if (k === 'fillText') return (s, x, y) => texts.push({ s, x, y, style: t.fillStyle });
      if (k === 'fillRect') return (x, y, w, h) => fills.push({ x, y, w, h, style: t.fillStyle });
      if (String(k).startsWith('create')) return () => ({ addColorStop() {} });
      return () => {};
    },
    set(t, k, v) {
      t[k] = v;
      return true;
    },
  });
  globalThis.document ??= { createElement: () => ({ getContext: () => ctx }) };
  return ctx;
}
