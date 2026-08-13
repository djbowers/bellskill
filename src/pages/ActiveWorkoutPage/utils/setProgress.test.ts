import { describe, expect, test } from 'vitest';

import { MovementOptions } from '~/types';

import { getSetProgress } from './setProgress';

const movement = (repScheme: number[]): MovementOptions => ({
  movementName: 'Swing',
  repScheme,
  weightOneUnit: 'kilograms',
  weightOneValue: 24,
  weightTwoUnit: null,
  weightTwoValue: null,
});

const args = (overrides: Partial<Parameters<typeof getSetProgress>[0]> = {}) => ({
  completedRounds: 0,
  currentMovementIndex: 0,
  currentMovementRungIndex: 0,
  movements: [movement([5, 5]), movement([5, 5]), movement([5, 5])],
  workoutGoal: 2,
  workoutMode: 'circuit' as const,
  ...overrides,
});

describe('getSetProgress', () => {
  test('counts every movement as a set, so a 3-movement 2-rung circuit has 6 sets per round', () => {
    expect(getSetProgress(args())).toEqual({ completedSets: 0, totalSets: 12 });
  });

  test('advances mid-lap as movements are finished', () => {
    expect(getSetProgress(args({ currentMovementIndex: 1 }))).toEqual({
      completedSets: 1,
      totalSets: 12,
    });
    expect(getSetProgress(args({ currentMovementIndex: 2 }))).toEqual({
      completedSets: 2,
      totalSets: 12,
    });
  });

  test('advances across the shared rung pointer', () => {
    expect(
      getSetProgress(args({ currentMovementRungIndex: 1 })),
    ).toEqual({ completedSets: 3, totalSets: 12 });
  });

  test('is continuous across a round boundary', () => {
    // Last set of round 1: movement 3 at rung 2.
    const beforeBoundary = getSetProgress(
      args({ currentMovementIndex: 2, currentMovementRungIndex: 1 }),
    );
    expect(beforeBoundary).toEqual({ completedSets: 5, totalSets: 12 });

    // Finishing it wraps both indexes to 0 and bumps the round — the count must
    // step by exactly one, neither stalling nor jumping.
    expect(getSetProgress(args({ completedRounds: 1 }))).toEqual({
      completedSets: 6,
      totalSets: 12,
    });
  });

  test('reads the round length off the last movement when ladders are unequal', () => {
    const movements = [movement([5, 5, 5]), movement([10])];
    expect(getSetProgress(args({ movements, workoutGoal: 3 }))).toEqual({
      completedSets: 0,
      totalSets: 6,
    });
  });

  test('clamps to the total rather than reporting negative sets remaining', () => {
    expect(getSetProgress(args({ completedRounds: 5 }))).toEqual({
      completedSets: 12,
      totalSets: 12,
    });
  });

  test('handles a zero goal', () => {
    expect(getSetProgress(args({ workoutGoal: 0 }))).toEqual({
      completedSets: 0,
      totalSets: 0,
    });
  });

  test('returns null for complex, whose unit of work really is the round', () => {
    expect(getSetProgress(args({ workoutMode: 'complex' }))).toBeNull();
  });

  test('returns null for straight sets, whose goal is already a set count', () => {
    expect(getSetProgress(args({ workoutMode: 'straightSets' }))).toBeNull();
  });

  test('returns null when there are no movements', () => {
    expect(getSetProgress(args({ movements: [] }))).toBeNull();
  });
});
