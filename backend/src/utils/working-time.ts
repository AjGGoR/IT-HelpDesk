// Working-time calendar for SLA calculations.
//
// Working time is Monday-Friday, 08:00-16:00 wall-clock time in Europe/Warsaw,
// excluding Polish statutory public holidays (ustawa z dnia 18 stycznia 1951 r.
// o dniach wolnych od pracy, as amended - including Wigilia, 24 December,
// which is a statutory day off from 2025 onwards).
//
// All instants are plain `Date` objects (UTC internally). Wall-clock
// conversion goes through `Intl`, so DST changes are handled by the platform
// tz database; Polish DST switches happen at 02:00/03:00, outside working
// hours, so every working day is exactly 8 real hours long.

export const WORK_TIME_ZONE = 'Europe/Warsaw';
export const WORK_DAY_START_HOUR = 8;
export const WORK_DAY_END_HOUR = 16;
export const WORKING_MINUTES_PER_DAY = (WORK_DAY_END_HOUR - WORK_DAY_START_HOUR) * 60;

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

// Upper bound on day iterations, far beyond any realistic SLA span, so a
// malformed input can never spin forever.
const MAX_DAY_ITERATIONS = 366 * 50;

type CalendarDate = { year: number; month: number; day: number };

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: WORK_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

function zonedParts(instant: Date) {
  const values: Record<string, number> = {};
  for (const part of partsFormatter.formatToParts(instant))
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

// Offset (ms) of Europe/Warsaw wall-clock time from UTC at `instant`.
function zoneOffsetMs(instant: Date): number {
  const p = zonedParts(instant);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

// Converts a Europe/Warsaw wall-clock time to an instant. Only used for
// 08:00/16:00/00:00, which are never inside a DST gap or overlap in Poland.
export function zonedTimeToInstant(date: CalendarDate, hour: number, minute = 0): Date {
  const naive = Date.UTC(date.year, date.month - 1, date.day, hour, minute);
  let instant = naive - zoneOffsetMs(new Date(naive));
  const corrected = naive - zoneOffsetMs(new Date(instant));
  if (corrected !== instant) instant = corrected;
  return new Date(instant);
}

export function localDateOf(instant: Date): CalendarDate {
  const p = zonedParts(instant);
  return { year: p.year, month: p.month, day: p.day };
}

function addCalendarDays(date: CalendarDate, days: number): CalendarDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day) + days * DAY_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

const dateKey = (date: CalendarDate) =>
  `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;

// Gregorian Easter Sunday (anonymous Gregorian / Meeus-Jones-Butcher algorithm).
export function easterSunday(year: number): CalendarDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { year, month, day };
}

// One-off statutory days off established by separate acts.
const ONE_OFF_HOLIDAYS = new Set(['2018-11-12']);

const holidayCache = new Map<number, Set<string>>();

// Every statutory non-working day in `year` as YYYY-MM-DD keys (Sundays that
// are holidays - Easter Sunday, Pentecost - are included for completeness).
export function polishPublicHolidays(year: number): Set<string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const fixed: [number, number][] = [
    [1, 1], // Nowy Rok
    [1, 6], // Święto Trzech Króli (since 2011)
    [5, 1], // Święto Pracy
    [5, 3], // Święto Konstytucji 3 Maja
    [8, 15], // Wniebowzięcie NMP
    [11, 1], // Wszystkich Świętych
    [11, 11], // Narodowe Święto Niepodległości
    [12, 25], // Boże Narodzenie (pierwszy dzień)
    [12, 26], // Boże Narodzenie (drugi dzień)
  ];
  const keys = fixed
    .filter(([month, day]) => !(month === 1 && day === 6 && year < 2011))
    .map(([month, day]) => dateKey({ year, month, day }));
  if (year >= 2025) keys.push(dateKey({ year, month: 12, day: 24 })); // Wigilia
  const easter = easterSunday(year);
  for (const offset of [0, 1, 49, 60])
    // Wielkanoc, Poniedziałek Wielkanocny, Zielone Świątki, Boże Ciało
    keys.push(dateKey(addCalendarDays(easter, offset)));
  for (const key of ONE_OFF_HOLIDAYS) if (key.startsWith(`${year}-`)) keys.push(key);
  const set = new Set(keys);
  holidayCache.set(year, set);
  return set;
}

export function isWorkingDay(date: CalendarDate): boolean {
  const weekday = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  return !polishPublicHolidays(date.year).has(dateKey(date));
}

// Windows are pure functions of the calendar date, so they are memoised to
// keep repeated SLA evaluations (every ticket in every list response) cheap.
const windowCache = new Map<string, [number, number]>();

function workWindow(date: CalendarDate): [number, number] {
  const key = dateKey(date);
  const cached = windowCache.get(key);
  if (cached) return cached;
  const window: [number, number] = [
    zonedTimeToInstant(date, WORK_DAY_START_HOUR).getTime(),
    zonedTimeToInstant(date, WORK_DAY_END_HOUR).getTime(),
  ];
  windowCache.set(key, window);
  return window;
}

// The instant at which `minutes` of working time have elapsed after `start`.
// When the budget is used up exactly at the end of a working day the result
// is that day's 16:00 (not the next working day's 08:00).
export function addWorkingMinutes(start: Date, minutes: number): Date {
  if (!Number.isFinite(minutes) || minutes < 0)
    throw new RangeError('Working minutes must be a non-negative finite number.');
  let remainingMs = minutes * MINUTE_MS;
  let date = localDateOf(start);
  for (let i = 0; i < MAX_DAY_ITERATIONS; i += 1, date = addCalendarDays(date, 1)) {
    if (!isWorkingDay(date)) continue;
    const [windowStart, windowEnd] = workWindow(date);
    const from = Math.max(start.getTime(), windowStart);
    if (from >= windowEnd) continue;
    if (remainingMs <= windowEnd - from) return new Date(from + remainingMs);
    remainingMs -= windowEnd - from;
  }
  throw new RangeError('Working-time calculation exceeded the supported range.');
}

// Signed working minutes between two instants: positive when `to` is after
// `from`, negative when it is before (e.g. how far past a deadline we are).
// Partial minutes round toward the deadline, so a deadline missed by seconds
// is reported as -1, never as 0.
export function workingMinutesBetween(from: Date, to: Date): number {
  if (to.getTime() < from.getTime()) return -Math.ceil(workingMsBetween(to, from) / MINUTE_MS);
  return Math.floor(workingMsBetween(from, to) / MINUTE_MS);
}

function workingMsBetween(from: Date, to: Date): number {
  let totalMs = 0;
  let date = localDateOf(from);
  const lastKey = dateKey(localDateOf(to));
  for (let i = 0; i < MAX_DAY_ITERATIONS; i += 1, date = addCalendarDays(date, 1)) {
    if (isWorkingDay(date)) {
      const [windowStart, windowEnd] = workWindow(date);
      const overlap = Math.min(windowEnd, to.getTime()) - Math.max(windowStart, from.getTime());
      if (overlap > 0) totalMs += overlap;
    }
    if (dateKey(date) === lastKey) return totalMs;
  }
  throw new RangeError('Working-time calculation exceeded the supported range.');
}

// End (16:00) of the current working day, or null when `now` falls on a
// weekend or public holiday.
export function endOfWorkingDay(now: Date): Date | null {
  const date = localDateOf(now);
  return isWorkingDay(date) ? zonedTimeToInstant(date, WORK_DAY_END_HOUR) : null;
}
