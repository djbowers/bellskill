import { DateTime } from 'luxon';

import { cn } from '~/lib/utils';

import {
  INTENSITY_BG,
  INTENSITY_LABEL,
  RPE_INTENSITY,
  WorkoutDay,
  hardestRpe,
  startOfWeek,
} from '../utils';

const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export interface WeekStripProps {
  weekYear: number;
  weekNumber: number;
  workoutDays: WorkoutDay[];
}

interface DayCell {
  weekday: DateTime;
  trained: boolean;
  isFuture: boolean;
  fill: string;
  /** Exertion wording for the day, or null when trained but never rated. */
  intensityLabel: string | null;
}

/**
 * Seven segments, one per day of the ISO week, tinted by that day's hardest
 * exertion rating. Gives the week its shape before you read a single row.
 */
export const WeekStrip = ({
  weekYear,
  weekNumber,
  workoutDays,
}: WeekStripProps) => {
  const cells = buildCells(weekYear, weekNumber, workoutDays);

  return (
    <div role="img" aria-label={describeWeek(cells)}>
      <div aria-hidden className="flex gap-0.5">
        {WEEKDAY_LETTERS.map((letter, index) => (
          <div
            key={index}
            className="flex-1 text-center text-[10px] uppercase tracking-wider text-muted-foreground"
          >
            {letter}
          </div>
        ))}
      </div>

      <div aria-hidden className="mt-0.5 flex gap-0.5">
        {cells.map(({ fill }, index) => (
          <div key={index} className={cn('h-1 flex-1 rounded-full', fill)} />
        ))}
      </div>
    </div>
  );
};

const buildCells = (
  weekYear: number,
  weekNumber: number,
  workoutDays: WorkoutDay[],
): DayCell[] => {
  const monday = startOfWeek(weekYear, weekNumber);
  const today = DateTime.now().startOf('day');

  return WEEKDAY_LETTERS.map((_, index) => {
    const weekday = monday.plus({ days: index });
    const day = workoutDays.find(({ date }) =>
      DateTime.fromJSDate(date).hasSame(weekday, 'day'),
    );
    const rpe = day ? hardestRpe(day.workoutLogs) : null;

    return {
      weekday,
      trained: Boolean(day),
      isFuture: weekday > today,
      intensityLabel: rpe ? INTENSITY_LABEL[RPE_INTENSITY[rpe]] : null,
      fill: resolveFill(Boolean(day), rpe, weekday > today),
    };
  });
};

const resolveFill = (
  trained: boolean,
  rpe: ReturnType<typeof hardestRpe>,
  isFuture: boolean,
): string => {
  // A logged-but-unrated day still happened, so it reads as filled — just
  // without a place on the exertion ramp.
  if (trained) {
    return rpe ? INTENSITY_BG[RPE_INTENSITY[rpe]] : 'bg-muted-foreground/50';
  }
  // A day that hasn't arrived yet isn't a day you skipped.
  return isFuture ? 'bg-muted/40' : 'bg-muted';
};

const describeWeek = (cells: DayCell[]): string => {
  const trained = cells.filter((cell) => cell.trained);

  if (trained.length === 0) return 'No workouts this week.';

  const sessions = trained
    .map(
      ({ weekday, intensityLabel }) =>
        `${weekday.toFormat('cccc')}${intensityLabel ? ` ${intensityLabel.toLowerCase()}` : ' unrated'}`,
    )
    .join(', ');

  const untrained = cells.filter(
    (cell) => !cell.trained && !cell.isFuture,
  ).length;

  return untrained > 0
    ? `${sessions}. ${untrained} ${untrained === 1 ? 'day' : 'days'} not trained.`
    : `${sessions}.`;
};
