import {
  daysBetweenCalendarDays,
  localDateString,
  parseLocalDateString,
  startOfDay,
} from './dateOnly';

describe('startOfDay', () => {
  test('zeroes out the time of day', () => {
    expect(startOfDay(new Date(2026, 5, 24, 23, 59, 59))).toEqual(
      new Date(2026, 5, 24, 0, 0, 0),
    );
  });
});

describe('daysBetweenCalendarDays', () => {
  test('same calendar day, regardless of time of day, is 0', () => {
    const morning = new Date(2026, 5, 24, 6, 0, 0);
    const night = new Date(2026, 5, 24, 23, 0, 0);
    expect(daysBetweenCalendarDays(morning, night)).toBe(0);
  });

  test('logged yesterday evening, now this morning -> 1 (not 0)', () => {
    // Only ~14 hours elapsed, but a calendar midnight has passed — this is the
    // exact case the raw elapsed-ms computation used to misreport as "today".
    const loggedYesterdayEvening = new Date(2026, 5, 23, 19, 0, 0);
    const thisMorning = new Date(2026, 5, 24, 9, 0, 0);
    expect(daysBetweenCalendarDays(loggedYesterdayEvening, thisMorning)).toBe(1);
  });

  test('just before midnight vs just after midnight is still 1 day apart', () => {
    const before = new Date(2026, 5, 23, 23, 59, 59);
    const after = new Date(2026, 5, 24, 0, 0, 1);
    expect(daysBetweenCalendarDays(before, after)).toBe(1);
  });

  test('multi-day gap', () => {
    const from = new Date(2026, 5, 20, 12, 0, 0);
    const to = new Date(2026, 5, 24, 8, 0, 0);
    expect(daysBetweenCalendarDays(from, to)).toBe(4);
  });

  test('to before from is negative', () => {
    const from = new Date(2026, 5, 24);
    const to = new Date(2026, 5, 22);
    expect(daysBetweenCalendarDays(from, to)).toBe(-2);
  });
});

describe('localDateString / parseLocalDateString', () => {
  test('round-trips a local date', () => {
    const date = new Date(2026, 5, 4, 15, 30);
    expect(localDateString(date)).toBe('2026-06-04');
    expect(parseLocalDateString('2026-06-04')).toEqual(new Date(2026, 5, 4));
  });

  test('parseLocalDateString rejects malformed input', () => {
    expect(parseLocalDateString('not-a-date')).toBeNull();
    expect(parseLocalDateString('2026-13-40')).toBeNull();
  });
});
