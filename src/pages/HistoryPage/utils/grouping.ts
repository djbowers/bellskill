import { DateTime } from 'luxon';

import { WorkoutLog } from '~/types';

export interface WorkoutDay {
  date: Date;
  workoutLogs: WorkoutLog[];
}

export interface WorkoutWeek {
  weekKey: string;
  weekYear: number;
  weekNumber: number;
  workoutDays: WorkoutDay[];
}

export const groupByDate = (workoutLogs: WorkoutLog[] = []): WorkoutDay[] => {
  const groupedByDate: { [dateKey: string]: WorkoutLog[] } = {};

  workoutLogs.forEach((log) => {
    const dateKey = log.startedAt.toDateString();
    if (!groupedByDate[dateKey]) {
      groupedByDate[dateKey] = [];
    }
    groupedByDate[dateKey].push(log);
    groupedByDate[dateKey].sort(
      (a, b) => a.startedAt.getTime() - b.startedAt.getTime(),
    );
  });

  return Object.entries(groupedByDate)
    .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
    .map(([dateKey, workoutLogs]) => ({
      date: new Date(dateKey),
      workoutLogs,
    }));
};

export const groupByWeek = (workoutDays: WorkoutDay[]): WorkoutWeek[] => {
  const groupedByWeek: { [weekKey: string]: WorkoutDay[] } = {};

  workoutDays.forEach((workoutDay) => {
    const year = DateTime.fromJSDate(workoutDay.date).weekYear;
    const weekNumber = DateTime.fromJSDate(workoutDay.date).weekNumber;
    const weekKey = `${year}-W${weekNumber}`;
    if (!groupedByWeek[weekKey]) {
      groupedByWeek[weekKey] = [];
    }
    groupedByWeek[weekKey].push(workoutDay);
    groupedByWeek[weekKey].sort((a, b) => b.date.getTime() - a.date.getTime());
  });

  return Object.entries(groupedByWeek)
    .map(([weekKey, workoutDays]) => ({
      weekKey,
      weekYear: Number(weekKey.split('-W')[0]),
      weekNumber: Number(weekKey.split('-W')[1]),
      workoutDays,
    }))
    .sort(
      (a, b) =>
        b.workoutDays[0].date.getTime() - a.workoutDays[0].date.getTime(),
    );
};

// "Week 27" means nothing to a human — label weeks relative to today, then by
// date range once they're further back.
export const getWeekLabel = (weekYear: number, weekNumber: number): string => {
  const now = DateTime.now();
  if (weekYear === now.weekYear && weekNumber === now.weekNumber) {
    return 'This week';
  }

  const lastWeek = now.minus({ weeks: 1 });
  if (weekYear === lastWeek.weekYear && weekNumber === lastWeek.weekNumber) {
    return 'Last week';
  }

  const start = startOfWeek(weekYear, weekNumber);
  const end = start.plus({ days: 6 });
  const range =
    start.month === end.month
      ? `${start.toFormat('MMM d')} – ${end.toFormat('d')}`
      : `${start.toFormat('MMM d')} – ${end.toFormat('MMM d')}`;

  return start.year === now.year ? range : `${range}, ${start.year}`;
};

/** Monday of an ISO week — the anchor both the label and the strip build from. */
export const startOfWeek = (weekYear: number, weekNumber: number): DateTime =>
  DateTime.fromObject({ weekYear, weekNumber, weekday: 1 });
