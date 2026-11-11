// The calculator's brain. Two parts: `press` is the key-by-key machine behind
// the window (an ordinary pocket calculator), and `evaluate` reads a whole
// typed expression for the command prompt: + - * / % ^ and brackets.

/// How a number is shown: no float noise, no trailing zeros, at most 12 digits.
export function format(n) {
  if (!Number.isFinite(n)) return 'Error';
  const s = String(Number(n.toPrecision(12)));
  return s.includes('e') ? n.toExponential(6) : s;
}

/// A fresh calculator.
export function makeCalc() {
  return { entry: '0', acc: null, op: null, fresh: true, line: '' };
}

function apply(a, op, b) {
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  if (op === '*') return a * b;
  if (op === '/') return b === 0 ? NaN : a / b;
  return b;
}

/// Presses one key: a digit, `.`, `+ - * /`, `=`, `C`, `back`, `neg` or `%`.
export function press(c, key) {
  if (c.entry === 'Error' && key !== 'C') Object.assign(c, makeCalc());
  if (/^\d$/.test(key)) {
    if (c.fresh) {
      c.entry = key;
      c.fresh = false;
    } else if (c.entry.replace(/[-.]/g, '').length < 14) c.entry = c.entry === '0' ? key : c.entry + key;
  } else if (key === '.') {
    if (c.fresh) {
      c.entry = '0.';
      c.fresh = false;
    } else if (!c.entry.includes('.')) c.entry += '.';
  } else if (key.length === 1 && '+-*/'.includes(key)) {
    if (c.op && !c.fresh) {
      c.acc = apply(c.acc, c.op, Number(c.entry));
      c.entry = format(c.acc);
    } else if (!c.op) c.acc = Number(c.entry);
    c.op = key;
    c.fresh = true;
    c.line = `${format(c.acc)} ${key}`;
  } else if (key === '=') {
    if (c.op) {
      const b = Number(c.entry);
      const r = apply(c.acc, c.op, b);
      c.line = `${format(c.acc)} ${c.op} ${format(b)} =`;
      c.entry = format(r);
      c.acc = null;
      c.op = null;
      c.fresh = true;
    }
  } else if (key === 'C') Object.assign(c, makeCalc());
  else if (key === 'back') {
    if (!c.fresh) c.entry = c.entry.length > 1 && !(c.entry.length === 2 && c.entry.startsWith('-')) ? c.entry.slice(0, -1) : '0';
  } else if (key === 'neg') {
    if (c.entry !== '0') c.entry = c.entry.startsWith('-') ? c.entry.slice(1) : `-${c.entry}`;
  } else if (key === '%') {
    c.entry = format(Number(c.entry) / 100);
    c.fresh = true;
  }
  return c;
}

/// Reads and works out a typed expression. Throws an Error with a plain message.
export function evaluate(text) {
  const src = String(text).replace(/\s+/g, '');
  if (!src) throw new Error('nothing to work out');
  if (!/^[\d.+\-*/%^()]+$/.test(src)) throw new Error('only numbers and + - * / % ^ ( ) please');
  let i = 0;
  const peek = () => src[i];
  const number = () => {
    const m = /^\d*\.?\d+|^\d+\.?/.exec(src.slice(i));
    if (!m) throw new Error(`a number was expected at position ${i + 1}`);
    i += m[0].length;
    return Number(m[0]);
  };
  const atom = () => {
    if (peek() === '-') { i += 1; return -power(); }
    if (peek() === '+') { i += 1; return power(); }
    if (peek() === '(') {
      i += 1;
      const v = sum();
      if (peek() !== ')') throw new Error('a closing bracket is missing');
      i += 1;
      return v;
    }
    return number();
  };
  const power = () => {
    const base = atom();
    if (peek() === '^') { i += 1; return base ** power(); }
    return base;
  };
  const product = () => {
    let v = power();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = src[i];
      i += 1;
      const r = power();
      if ((op === '/' || op === '%') && r === 0) throw new Error('cannot divide by zero');
      v = op === '*' ? v * r : op === '/' ? v / r : v % r;
    }
    return v;
  };
  function sum() {
    let v = product();
    while (peek() === '+' || peek() === '-') {
      const op = src[i];
      i += 1;
      const r = product();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  const out = sum();
  if (i < src.length) throw new Error(`unexpected "${src[i]}" at position ${i + 1}`);
  if (!Number.isFinite(out)) throw new Error('that is too large to show');
  return out;
}
