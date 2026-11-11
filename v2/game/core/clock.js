// The game clock: one game minute per `SECONDS_PER_MINUTE` real seconds.
// The campaign starts on 12 MAR 2027, so the calendar is a simple month walk:
// campaigns last weeks, not decades.

export const SECONDS_PER_MINUTE = 1.4;
export const MINUTES_PER_DAY = 1440;

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

/// The clock state: minutes since the campaign began.
export function makeClock(minutes = 0) {
  return { minutes };
}

export function advance(clock, minutes) {
  clock.minutes += Math.max(0, minutes);
}

export function day(clock) {
  return Math.floor(clock.minutes / MINUTES_PER_DAY);
}

export function minuteOfDay(clock) {
  return clock.minutes % MINUTES_PER_DAY;
}

export function hour(clock) {
  return Math.floor(minuteOfDay(clock) / 60);
}

export function minute(clock) {
  return minuteOfDay(clock) % 60;
}

export function hhmm(clock) {
  return `${String(hour(clock)).padStart(2, '0')}:${String(minute(clock)).padStart(2, '0')}`;
}

/// "DAY 4 - 03 APR 2027"
export function dateLine(clock) {
  const [d, m, y] = calendar(clock);
  return `${String(d).padStart(2, '0')} ${MONTHS[m]} ${y}`;
}

/// 12 MAR 2027 is a Friday.
export function weekday(clock) {
  return WEEKDAYS[(4 + day(clock)) % 7];
}

/// The deadline format used everywhere: "2D 04H", "07H 12M", "38M".
export function span(minutes) {
  if (minutes >= MINUTES_PER_DAY * 2) {
    return `${Math.floor(minutes / MINUTES_PER_DAY)}D ${String(Math.floor((minutes % MINUTES_PER_DAY) / 60)).padStart(2, '0')}H`;
  }
  if (minutes >= MINUTES_PER_DAY) {
    return `1D ${String(Math.floor((minutes % MINUTES_PER_DAY) / 60)).padStart(2, '0')}H ${String(minutes % 60).padStart(2, '0')}M`;
  }
  if (minutes >= 60) {
    return `${Math.floor(minutes / 60)}H ${String(minutes % 60).padStart(2, '0')}M`;
  }
  return `${minutes}M`;
}

/// The day, the month and the year.
function calendar(clock) {
  let dayOfYear = 70 + day(clock);
  let year = 2027;
  for (;;) {
    const len = isLeap(year) ? 366 : 365;
    if (dayOfYear < len) break;
    dayOfYear -= len;
    year += 1;
  }
  const leap = isLeap(year);
  const monthLen = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let m = 0;
  let d = dayOfYear;
  while (d >= monthLen[m]) {
    d -= monthLen[m];
    m += 1;
  }
  return [d + 1, m, year];
}

function isLeap(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}
