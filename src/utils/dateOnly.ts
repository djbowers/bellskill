// Calendar-day (not elapsed-time) date math. "Days ago" should mean "how many
// local midnights have passed," not "how many 24-hour periods" — the latter
// misreports a workout from yesterday evening as "today" for anyone checking
// before that same time of day has re-elapsed.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** Whole calendar days between two dates' local midnights. `to` may precede `from`. */
export const daysBetweenCalendarDays = (from: Date, to: Date): number =>
  Math.floor((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);

/** Today's date as `YYYY-MM-DD` in the local timezone (not UTC — see `Date.toISOString`). */
export const localDateString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** Parses a `YYYY-MM-DD` string as a local calendar date (midnight local time). */
export const parseLocalDateString = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const date = new Date(year, month - 1, day);
  // Date rolls over out-of-range fields (e.g. month 13) instead of erroring —
  // reject anything that didn't round-trip to the fields we parsed.
  const roundTrips =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;
  return roundTrips ? date : null;
};
