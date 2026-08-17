import { describe, expect, test } from 'vitest';

import { MovementHistoryEntry } from '~/api';

import { computeMovementStats, getLastTrainedLabel } from './stats';

const entry = (
  fields: Partial<MovementHistoryEntry>,
): MovementHistoryEntry => ({
  movementLogId: 1,
  workoutLogId: 1,
  workoutTitle: null,
  startedAt: new Date('2026-07-30T10:00:00Z'),
  rpe: null,
  repScheme: [5, 5, 5],
  timedRungs: false,
  unilateral: false,
  weightOneUnit: 'kilograms',
  weightOneValue: 16,
  weightTwoUnit: null,
  weightTwoValue: null,
  ...fields,
});

describe('computeMovementStats', () => {
  test('counts distinct workouts as sessions', () => {
    const stats = computeMovementStats([
      entry({ movementLogId: 1, workoutLogId: 1 }),
      entry({ movementLogId: 2, workoutLogId: 1 }),
      entry({ movementLogId: 3, workoutLogId: 2 }),
    ]);
    expect(stats.sessionCount).toBe(2);
  });

  test('sums reps but skips timed rungs', () => {
    const stats = computeMovementStats([
      entry({ repScheme: [1, 2, 3] }),
      entry({ movementLogId: 2, repScheme: [30, 30], timedRungs: true }),
    ]);
    expect(stats.totalReps).toBe(6);
  });

  test('finds the heaviest bell across units', () => {
    const stats = computeMovementStats([
      entry({ weightOneValue: 24, weightOneUnit: 'kilograms' }),
      entry({
        movementLogId: 2,
        weightOneValue: 70,
        weightOneUnit: 'pounds',
      }),
    ]);
    // 70 lb ≈ 31.8 kg, heavier than 24 kg
    expect(stats.heaviestWeightValue).toBe(70);
    expect(stats.heaviestWeightUnit).toBe('pounds');
  });

  test('ignores null and zero weights', () => {
    const stats = computeMovementStats([
      entry({ weightOneValue: null, weightTwoValue: 0 }),
    ]);
    expect(stats.heaviestWeightValue).toBeNull();
  });

  test('returns the most recent startedAt as lastTrainedAt', () => {
    const stats = computeMovementStats([
      entry({ startedAt: new Date('2026-07-01T10:00:00Z') }),
      entry({ movementLogId: 2, startedAt: new Date('2026-07-30T10:00:00Z') }),
    ]);
    expect(stats.lastTrainedAt).toEqual(new Date('2026-07-30T10:00:00Z'));
  });
});

describe('getLastTrainedLabel', () => {
  test('returns null for empty history', () => {
    expect(getLastTrainedLabel([])).toBeNull();
  });

  test('labels today and yesterday', () => {
    expect(getLastTrainedLabel([entry({ startedAt: new Date() })])).toBe(
      'today',
    );
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(getLastTrainedLabel([entry({ startedAt: yesterday })])).toBe(
      'yesterday',
    );
  });

  test('labels older sessions in days', () => {
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    expect(getLastTrainedLabel([entry({ startedAt: fiveDaysAgo })])).toBe(
      '5 days ago',
    );
  });
});
