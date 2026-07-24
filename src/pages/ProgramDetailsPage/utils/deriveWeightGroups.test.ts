import { ProgramSession, WeightUnit, WorkoutOptions } from '~/types';

import { deriveStartingWeight, deriveWeightGroups } from './deriveWeightGroups';

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

/** Per-session fields only the grouping cares about; weights stay the focus. */
interface SessionExtras {
  weekNumber?: number;
  weightLabel?: string | null;
}

const firstMovementSession = (
  firstMovement: MovementWeights,
  shared: SharedWeights = NO_SHARED,
  extras: SessionExtras = {},
): ProgramSession => ({
  id: 'x',
  programId: 'p',
  sequenceIndex: 0,
  weekNumber: extras.weekNumber ?? 1,
  dayNumber: 1,
  title: 't',
  notes: null,
  weightLabel: extras.weightLabel ?? null,
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
const single = (value: number, extras: SessionExtras = {}): ProgramSession =>
  firstMovementSession(
    {
      weightOneValue: value,
      weightOneUnit: kg(value),
      weightTwoValue: 0,
      weightTwoUnit: null,
    },
    NO_SHARED,
    extras,
  );

// double loading via the session's own first movement.
const double = (value: number, extras: SessionExtras = {}): ProgramSession =>
  firstMovementSession(
    {
      weightOneValue: value,
      weightOneUnit: kg(value),
      weightTwoValue: value,
      weightTwoUnit: kg(value),
    },
    NO_SHARED,
    extras,
  );

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

describe('deriveWeightGroups', () => {
  it('finds a single group for a program with one weight (10,000 Swing)', () => {
    const groups = deriveWeightGroups(
      Array.from({ length: 20 }, () => twoHand(24)),
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].isModal).toBe(true);
    expect(groups[0].sessionCount).toBe(20);
  });

  it('splits the working weight from the deload weeks (A+A Protocol)', () => {
    const sessions = [
      ...Array.from({ length: 12 }, (_, i) =>
        single(24, { weekNumber: [1, 1, 2, 2, 3, 3, 5, 5, 6, 6, 7, 7][i] }),
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        single(16, {
          weekNumber: [4, 4, 8, 8][i],
          weightLabel: 'Deload weeks',
        }),
      ),
    ];

    const groups = deriveWeightGroups(sessions);
    expect(groups).toHaveLength(2);

    const working = groups.find((g) => g.isModal)!;
    expect(working.sourceWeight.sharedWeightOneValue).toBe(24);
    expect(working.sessionCount).toBe(12);

    const deload = groups.find((g) => !g.isModal)!;
    expect(deload.sourceWeight.sharedWeightOneValue).toBe(16);
    expect(deload.sessionCount).toBe(4);
    expect(deload.weekNumbers).toEqual([4, 8]);
    expect(deload.label).toBe('Deload weeks');
  });

  it('describes an unlabelled group by its offset and weeks (DFW test day)', () => {
    const sessions = [
      ...Array.from({ length: 13 }, () => double(24)),
      double(28, { weekNumber: 5 }),
    ];

    const testDay = deriveWeightGroups(sessions).find((g) => !g.isModal)!;
    expect(testDay.label).toBeNull();
    expect(testDay.description).toBe('4 kg heavier · week 5');
  });

  it('falls back to a session count once a group spans more than four weeks', () => {
    const sessions = [
      ...Array.from({ length: 11 }, () => single(24)),
      ...Array.from({ length: 10 }, (_, i) =>
        single(20, { weekNumber: i + 1 }),
      ),
    ];

    const light = deriveWeightGroups(sessions).find(
      (g) => g.sourceWeight.sharedWeightOneValue === 20,
    )!;
    expect(light.description).toBe('4 kg lighter · 10 sessions');
  });

  it('finds all three rungs of a rotating ladder (Snatch Test)', () => {
    const counts: Array<[number, number]> = [
      [28, 9],
      [24, 11],
      [20, 10],
    ];
    const sessions = counts.flatMap(([value, n]) =>
      Array.from({ length: n }, () => single(value)),
    );

    const groups = deriveWeightGroups(sessions);
    // First-appearance order, so the picker lists them the way the plan reads.
    expect(groups.map((g) => g.sourceWeight.sharedWeightOneValue)).toEqual([
      28, 24, 20,
    ]);
    expect(groups.filter((g) => g.isModal)).toHaveLength(1);
    expect(groups.find((g) => g.isModal)!.sourceWeight.sharedWeightOneValue)
      .toBe(24);
  });

  it('returns no groups for an all-bodyweight program', () => {
    const bodyweight = firstMovementSession({
      weightOneValue: null,
      weightOneUnit: null,
      weightTwoValue: null,
      weightTwoUnit: null,
    });
    expect(deriveWeightGroups([bodyweight])).toEqual([]);
  });
});
