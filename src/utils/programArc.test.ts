import {
  deriveProgramArc,
  formatFinishDate,
  programPaceLabel,
} from './programArc';

// Local-time dates throughout: the arc is calendar-day math, so a fixed
// midday "today" keeps every case independent of the test runner's timezone.
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);

const dfw = {
  enrollment: { startedAt: day(2026, 10, 5).toISOString() },
  program: { numWeeks: 6, daysPerWeek: 3, defaultAutoRepeat: false },
  progress: { completed: 7, total: 18 },
};

describe('deriveProgramArc', () => {
  test('positions the enrollee on session and day, and sizes the arc from the cadence', () => {
    const arc = deriveProgramArc(dfw, day(2026, 10, 16));

    expect(arc).toMatchObject({
      sessionNumber: 8,
      totalSessions: 18,
      dayNumber: 12,
      totalDays: 42,
    });
  });

  test('on pace: sessions completed match what the cadence expected by today', () => {
    // Day 12 → 11 days elapsed → floor(11 * 3 / 7) = 4 sessions expected.
    const arc = deriveProgramArc(
      { ...dfw, progress: { completed: 4, total: 18 } },
      day(2026, 10, 16),
    );

    expect(arc?.sessionsAhead).toBe(0);
    // 14 sessions left at 3/week → ceil(14 * 7 / 3) = 33 days out.
    expect(arc?.projectedFinish).toEqual(startOfLocalDay(day(2026, 11, 18)));
  });

  test('ahead: extra sessions pull the projected finish earlier', () => {
    const arc = deriveProgramArc(dfw, day(2026, 10, 16));

    expect(arc?.sessionsAhead).toBe(3);
    // 11 left → ceil(77 / 3) = 26 days → Nov 11.
    expect(arc?.projectedFinish).toEqual(startOfLocalDay(day(2026, 11, 11)));
  });

  test('behind: a lost week pushes the projected finish later', () => {
    const arc = deriveProgramArc(
      { ...dfw, progress: { completed: 1, total: 18 } },
      day(2026, 10, 16),
    );

    expect(arc?.sessionsAhead).toBe(-3);
    // 17 left → ceil(119 / 3) = 40 days → Nov 25.
    expect(arc?.projectedFinish).toEqual(startOfLocalDay(day(2026, 11, 25)));
  });

  test('expected sessions never exceed the program, so overrunning the calendar reads as behind by what is left', () => {
    const arc = deriveProgramArc(
      { ...dfw, progress: { completed: 16, total: 18 } },
      day(2027, 1, 1),
    );

    expect(arc?.sessionsAhead).toBe(-2);
    expect(arc?.dayNumber).toBe(89);
  });

  test('the enrollment day is day 1, never day 0', () => {
    const arc = deriveProgramArc(
      { ...dfw, progress: { completed: 0, total: 18 } },
      day(2026, 10, 5),
    );

    expect(arc?.dayNumber).toBe(1);
    expect(arc?.sessionNumber).toBe(1);
    expect(arc?.sessionsAhead).toBe(0);
  });

  test('a finished program pins the session number to the last one', () => {
    const arc = deriveProgramArc(
      { ...dfw, progress: { completed: 18, total: 18 } },
      day(2026, 11, 1),
    );

    expect(arc?.sessionNumber).toBe(18);
  });

  test('no cadence: session position only, no days or finish', () => {
    const arc = deriveProgramArc(
      {
        ...dfw,
        program: {
          numWeeks: null,
          daysPerWeek: null,
          defaultAutoRepeat: false,
        },
      },
      day(2026, 10, 16),
    );

    expect(arc).toEqual({
      sessionNumber: 8,
      totalSessions: 18,
      dayNumber: 12,
      totalDays: null,
      projectedFinish: null,
      sessionsAhead: null,
    });
  });

  test('a repeating workout has no finish line', () => {
    const arc = deriveProgramArc(
      {
        ...dfw,
        program: { numWeeks: 1, daysPerWeek: 3, defaultAutoRepeat: true },
      },
      day(2026, 10, 16),
    );

    expect(arc?.totalDays).toBeNull();
    expect(arc?.projectedFinish).toBeNull();
    expect(arc?.sessionsAhead).toBeNull();
  });

  test('a program with no sessions has no arc', () => {
    expect(
      deriveProgramArc(
        { ...dfw, progress: { completed: 0, total: 0 } },
        day(2026, 10, 16),
      ),
    ).toBeNull();
  });
});

describe('programPaceLabel', () => {
  test.each([
    [0, 'On track'],
    [1, '1 session ahead'],
    [3, '3 sessions ahead'],
    [-1, '1 session behind'],
    [-2, '2 sessions behind'],
  ])('%i → %s', (sessionsAhead, label) => {
    expect(programPaceLabel(sessionsAhead)).toBe(label);
  });
});

describe('formatFinishDate', () => {
  test('month and day only, in the viewer locale', () => {
    expect(formatFinishDate(day(2026, 11, 11))).toBe('Nov 11');
  });
});

const startOfLocalDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());
