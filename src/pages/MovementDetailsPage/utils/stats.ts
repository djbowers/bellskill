import { DateTime } from 'luxon';

import { MovementHistoryEntry } from '~/api';

const KG_PER_POUND = 0.45359237;

const toKg = (value: number, unit: string | null) =>
  unit === 'pounds' ? value * KG_PER_POUND : value;

export interface MovementStats {
  sessionCount: number;
  totalReps: number;
  /** Heaviest single bell across all logs, in its logged unit. */
  heaviestWeightValue: number | null;
  heaviestWeightUnit: string | null;
  lastTrainedAt: Date | null;
}

export const computeMovementStats = (
  history: MovementHistoryEntry[],
): MovementStats => {
  const sessionCount = new Set(history.map((entry) => entry.workoutLogId)).size;

  const totalReps = history.reduce(
    (reps, entry) =>
      entry.timedRungs
        ? reps
        : reps + entry.repScheme.reduce((sum, rung) => sum + rung, 0),
    0,
  );

  let heaviestWeightValue: number | null = null;
  let heaviestWeightUnit: string | null = null;
  let heaviestKg = 0;
  for (const entry of history) {
    for (const [value, unit] of [
      [entry.weightOneValue, entry.weightOneUnit],
      [entry.weightTwoValue, entry.weightTwoUnit],
    ] as const) {
      if (value === null || value <= 0) continue;
      const kg = toKg(value, unit);
      if (kg > heaviestKg) {
        heaviestKg = kg;
        heaviestWeightValue = value;
        heaviestWeightUnit = unit;
      }
    }
  }

  const lastTrainedAt = history.reduce<Date | null>(
    (latest, entry) =>
      latest === null || entry.startedAt > latest ? entry.startedAt : latest,
    null,
  );

  return {
    sessionCount,
    totalReps,
    heaviestWeightValue,
    heaviestWeightUnit,
    lastTrainedAt,
  };
};

export const getLastTrainedLabel = (
  history: MovementHistoryEntry[],
): string | null => {
  const { lastTrainedAt } = computeMovementStats(history);
  if (lastTrainedAt === null) return null;

  const days = Math.floor(
    DateTime.now()
      .startOf('day')
      .diff(DateTime.fromJSDate(lastTrainedAt).startOf('day'), 'days').days,
  );
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
};
