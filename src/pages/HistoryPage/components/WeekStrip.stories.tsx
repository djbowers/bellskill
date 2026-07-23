import { Meta } from '@storybook/react';
import { DateTime, WeekdayNumbers } from 'luxon';

import { RpeOptions, WorkoutLog } from '~/types';

import { WorkoutDay } from '../utils';
import { WeekStrip } from './WeekStrip';

const now = DateTime.now();

const sessionOn = (date: Date, rpe: RpeOptions | null): WorkoutLog => ({
  completedAt: date,
  completedReps: 60,
  completedRounds: 10,
  completedRungs: 10,
  completedSides: null,
  completedVolume: 900,
  complexSet: false,
  id: date.getTime(),
  intervalTimer: 0,
  movements: ['Clean and Press'],
  restTimer: 0,
  rpe,
  sharedWeightOneUnit: null,
  sharedWeightOneValue: null,
  sharedWeightTwoUnit: null,
  sharedWeightTwoValue: null,
  startedAt: date,
  title: 'The Giant 3.0 W1D2',
  preWorkoutNotes: null,
  workoutGoal: 20,
  workoutGoalUnits: 'minutes',
  postWorkoutNotes: null,
});

const dayIn = (
  week: DateTime,
  weekday: WeekdayNumbers,
  rpe: RpeOptions | null,
): WorkoutDay => {
  const date = DateTime.fromObject({
    weekYear: week.weekYear,
    weekNumber: week.weekNumber,
    weekday,
  }).toJSDate();

  return { date, workoutLogs: [sessionOn(date, rpe)] };
};

export default {
  component: WeekStrip,
  args: { weekYear: now.weekYear, weekNumber: now.weekNumber },
  decorators: [
    (Story) => (
      <div className="max-w-md bg-card p-2">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WeekStrip>;

/** The full exertion ramp, no-effort through max-effort. */
export const FullWeek = {
  args: {
    workoutDays: [
      dayIn(now, 1, 'easy'),
      dayIn(now, 2, 'ideal'),
      dayIn(now, 3, 'hard'),
      dayIn(now, 4, 'noEffort'),
      dayIn(now, 5, 'maxEffort'),
      dayIn(now, 6, 'ideal'),
      dayIn(now, 7, 'easy'),
    ],
  },
};

export const SingleSession = {
  args: { workoutDays: [dayIn(now, 3, 'hard')] },
};

/** Logged but never rated — filled, but off the exertion ramp. */
export const Unrated = {
  args: { workoutDays: [dayIn(now, 2, null), dayIn(now, 4, 'ideal')] },
};

export const NothingLogged = {
  args: { workoutDays: [] },
};

/** A past week has no "not yet" days — every untrained day reads as skipped. */
export const PastWeek = (() => {
  const past = now.minus({ weeks: 6 });
  return {
    args: {
      weekYear: past.weekYear,
      weekNumber: past.weekNumber,
      workoutDays: [dayIn(past, 2, 'maxEffort'), dayIn(past, 5, 'easy')],
    },
  };
})();
