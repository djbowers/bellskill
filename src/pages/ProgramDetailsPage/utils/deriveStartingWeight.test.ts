import { ProgramSession, WeightUnit, WorkoutOptions } from '~/types';

import { deriveStartingWeight } from './deriveStartingWeight';

type MovementWeights = Pick<
  WorkoutOptions['movements'][number],
  'weightOneValue' | 'weightOneUnit' | 'weightTwoValue' | 'weightTwoUnit'
>;

type SharedWeights = Pick<
  WorkoutOptions,
  | 'sharedWeightOneValue'
  | 'sharedWeightOneUnit'
  | 'sharedWeightTwoValue'
  | 'sharedWeightTwoUnit'
>;

const NO_SHARED: SharedWeights = {
  sharedWeightOneValue: null,
  sharedWeightOneUnit: null,
  sharedWeightTwoValue: null,
  sharedWeightTwoUnit: null,
};

const kg = (value: number | null): WeightUnit | null =>
  value == null ? null : 'kilograms';

const firstMovementSession = (
  firstMovement: MovementWeights,
  shared: SharedWeights = NO_SHARED,
): ProgramSession => ({
  id: 'x',
  programId: 'p',
  sequenceIndex: 0,
  weekNumber: 1,
  dayNumber: 1,
  title: 't',
  notes: null,
  workoutOptions: {
    complexSet: false,
    intervalTimer: 0,
    restTimer: 0,
    title: null,
    preWorkoutNotes: null,
    workoutGoal: 0,
    workoutGoalUnits: 'minutes',
    ...shared,
    movements: [{ movementName: 'M', repScheme: [1], ...firstMovement }],
  },
});

// value + loading mode from a two-hand (weight two null) first movement.
const twoHand = (value: number): ProgramSession =>
  firstMovementSession({
    weightOneValue: value,
    weightOneUnit: kg(value),
    weightTwoValue: null,
    weightTwoUnit: null,
  });

// single/offset loading (weight two === 0).
const single = (value: number): ProgramSession =>
  firstMovementSession({
    weightOneValue: value,
    weightOneUnit: kg(value),
    weightTwoValue: 0,
    weightTwoUnit: null,
  });

// double loading via the session's own first movement.
const double = (value: number): ProgramSession =>
  firstMovementSession({
    weightOneValue: value,
    weightOneUnit: kg(value),
    weightTwoValue: value,
    weightTwoUnit: kg(value),
  });

// double loading carried on the session's *shared* weight (complex programs).
const sharedDouble = (value: number): ProgramSession =>
  firstMovementSession(
    {
      weightOneValue: value,
      weightOneUnit: kg(value),
      weightTwoValue: value,
      weightTwoUnit: kg(value),
    },
    {
      sharedWeightOneValue: value,
      sharedWeightOneUnit: 'kilograms',
      sharedWeightTwoValue: value,
      sharedWeightTwoUnit: 'kilograms',
    },
  );

describe('deriveStartingWeight', () => {
  it('derives two-hand loading for an all-two-hand program (10,000 Swing)', () => {
    expect(
      deriveStartingWeight(Array.from({ length: 20 }, () => twoHand(24))),
    ).toEqual({
      sharedWeightOneValue: 24,
      sharedWeightOneUnit: 'kilograms',
      sharedWeightTwoValue: null,
      sharedWeightTwoUnit: null,
    });
  });

  it('derives single loading and the modal weight (A+A Protocol)', () => {
    // Twelve working sessions at 24kg, four deload sessions at 16kg — 24 is
    // modal, so the deload weeks don't drag the pre-fill down.
    const sessions = [
      ...Array.from({ length: 12 }, () => single(24)),
      ...Array.from({ length: 4 }, () => single(16)),
    ];
    expect(deriveStartingWeight(sessions)).toEqual({
      sharedWeightOneValue: 24,
      sharedWeightOneUnit: 'kilograms',
      sharedWeightTwoValue: 0,
      sharedWeightTwoUnit: null,
    });
  });

  it('derives single loading with the modal weight across a rotating ladder (Snatch Test)', () => {
    // 28×9, 24×11, 20×10 — 24 is modal despite 28 leading the sequence.
    const counts: Array<[number, number]> = [
      [28, 9],
      [24, 11],
      [20, 10],
    ];
    const sessions = counts.flatMap(([value, n]) =>
      Array.from({ length: n }, () => single(value)),
    );
    expect(deriveStartingWeight(sessions)).toEqual({
      sharedWeightOneValue: 24,
      sharedWeightOneUnit: 'kilograms',
      sharedWeightTwoValue: 0,
      sharedWeightTwoUnit: null,
    });
  });

  it('derives double loading from first-movement weights (Dry Fighting Weight)', () => {
    // 13 sessions at double-24, one deliberately heavier test day at double-28.
    const sessions = [
      ...Array.from({ length: 13 }, () => double(24)),
      double(28),
    ];
    expect(deriveStartingWeight(sessions)).toEqual({
      sharedWeightOneValue: 24,
      sharedWeightOneUnit: 'kilograms',
      sharedWeightTwoValue: 24,
      sharedWeightTwoUnit: 'kilograms',
    });
  });

  it('derives double loading from the shared weight on a complex program (Armor Building)', () => {
    expect(
      deriveStartingWeight(Array.from({ length: 20 }, () => sharedDouble(24))),
    ).toEqual({
      sharedWeightOneValue: 24,
      sharedWeightOneUnit: 'kilograms',
      sharedWeightTwoValue: 24,
      sharedWeightTwoUnit: 'kilograms',
    });
  });

  it('breaks a weight tie toward the lighter first weight', () => {
    const sessions = [single(24), single(20)];
    expect(deriveStartingWeight(sessions).sharedWeightOneValue).toBe(20);
  });

  it('falls back to double-24kg for an empty or all-bodyweight program', () => {
    expect(deriveStartingWeight([])).toEqual({
      sharedWeightOneValue: 24,
      sharedWeightOneUnit: 'kilograms',
      sharedWeightTwoValue: 24,
      sharedWeightTwoUnit: 'kilograms',
    });

    const bodyweight = firstMovementSession({
      weightOneValue: null,
      weightOneUnit: null,
      weightTwoValue: null,
      weightTwoUnit: null,
    });
    expect(deriveStartingWeight([bodyweight]).sharedWeightOneValue).toBe(24);
  });
});
