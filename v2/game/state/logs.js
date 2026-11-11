// The operator's own logs, kept on the gateway as one file a day, named by the
// date (yymmdd.log) and holding everything that happened that day. Opening a
// file puts its text in a notepad.

/// The day the world starts, a Friday: day 1 of the game.
const START = Date.UTC(2027, 2, 12);

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const two = (n) => String(n).padStart(2, '0');

/// The calendar date of a game minute.
function dateOf(minute) {
  return new Date(START + Math.floor(minute / 1440) * 86400000);
}

/// The file name of the day a game minute falls in: yymmdd.log.
export function logName(minute) {
  const d = dateOf(minute);
  return `${two(d.getUTCFullYear() % 100)}${two(d.getUTCMonth() + 1)}${two(d.getUTCDate())}.log`;
}

/// The date as the game's clock writes it: FRI 12 MAR 2027.
export function logDate(minute) {
  const d = dateOf(minute);
  return `${DAYS[d.getUTCDay()]} ${two(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const stamp = (m) => `${two(Math.floor((m % 1440) / 60))}:${two(m % 60)}`;

/// One day's file: its name, the entries and the text a notepad shows.
function fileOf(minute, entries) {
  const name = logName(minute);
  const day = Math.floor(minute / 1440);
  const lines = entries.map((l) => `${stamp(l.minute)}  ${l.text}`);
  const text = [`${name}  //  ${logDate(minute)}  //  ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`, '', ...lines].join('\n');
  return { name, day, entries, text, size: text.length };
}

/// Every day the log has entries for, newest first, as files.
export function logFiles(game) {
  const days = new Map();
  (game.log ?? []).forEach((l) => {
    const d = Math.floor(l.minute / 1440);
    if (!days.has(d)) days.set(d, []);
    days.get(d).push(l);
  });
  return [...days.entries()].sort((a, b) => b[0] - a[0]).map(([d, entries]) => fileOf(d * 1440, entries));
}

/// The file of one day (a day number, 0 on the first), or null when nothing was logged.
export function logFile(game, day) {
  return logFiles(game).find((f) => f.day === day) ?? null;
}
