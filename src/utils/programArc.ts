import { daysBetweenCalendarDays, startOfDay } from './dateOnly';

/**
 * Where an enrollee stands in a program's arc: position, the finish line, and
 * pace against the cadence the program was written at. Everything is derived
 * from the enrollment date, the program's cadence, and the completions count —
 * no stored cursor.
 */
export interface ProgramArc {
  /** 1-based number of the next session (the last one once finished). */
  sessionNumber: number;
  totalSessions: number;
  /** 1-based calendar day of the enrollment; day 1 is the enrollment date. */
  dayNumber: number;
  /** `numWeeks × 7`, or `null` for repeating workouts and programs with no cadence. */
  totalDays: number | null;
  /**
   * When the remaining sessions land if trained at the program's cadence from
   * today, so the date moves with the enrollee's actual pace. Local midnight.
   */
  projectedFinish: Date | null;
  /**
   * Sessions completed minus sessions the cadence expected by today. Positive
   * is ahead, negative behind, zero on track. `null` without a cadence.
   */
  sessionsAhead: number | null;
}

export interface ProgramArcInput {
  enrollment: { startedAt: string };
  program: {
    numWeeks: number | null;
    daysPerWeek: number | null;
    defaultAutoRepeat: boolean;
  };
  progress: { completed: number; total: number };
}

const DAYS_PER_WEEK = 7;

export const deriveProgramArc = (
  { enrollment, program, progress }: ProgramArcInput,
  today: Date,
): ProgramArc | null => {
  if (progress.total === 0) return null;

  const sessionNumber = Math.min(progress.completed + 1, progress.total);
  const daysElapsed = Math.max(
    0,
    daysBetweenCalendarDays(new Date(enrollment.startedAt), today),
  );
  const dayNumber = daysElapsed + 1;

  const hasFinishLine =
    !program.defaultAutoRepeat && !!program.daysPerWeek && !!program.numWeeks;
  if (!hasFinishLine) {
    return {
      sessionNumber,
      totalSessions: progress.total,
      dayNumber,
      totalDays: null,
      projectedFinish: null,
      sessionsAhead: null,
    };
  }

  const daysPerWeek = program.daysPerWeek!;
  const expectedByToday = Math.min(
    progress.total,
    Math.floor((daysElapsed * daysPerWeek) / DAYS_PER_WEEK),
  );
  const remaining = progress.total - progress.completed;
  const daysToFinish = Math.ceil((remaining * DAYS_PER_WEEK) / daysPerWeek);
  const projectedFinish = startOfDay(today);
  projectedFinish.setDate(projectedFinish.getDate() + daysToFinish);

  return {
    sessionNumber,
    totalSessions: progress.total,
    dayNumber,
    totalDays: program.numWeeks! * DAYS_PER_WEEK,
    projectedFinish,
    sessionsAhead: progress.completed - expectedByToday,
  };
};

export const programPaceLabel = (sessionsAhead: number): string => {
  if (sessionsAhead === 0) return 'On track';
  const count = Math.abs(sessionsAhead);
  const noun = count === 1 ? 'session' : 'sessions';
  return `${count} ${noun} ${sessionsAhead > 0 ? 'ahead' : 'behind'}`;
};

export const formatFinishDate = (date: Date): string =>
  date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
