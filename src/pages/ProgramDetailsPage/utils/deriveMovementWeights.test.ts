import { MovementOptions, ProgramSession, WeightUnit } from '~/types';

import {
  deriveMovementWeights,
  isComplexProgram,
} from './deriveMovementWeights';

const kg = (value: number | null): WeightUnit | null =>
  value == null ? null : 'kilograms';

// A movement whose weight config is read from the null-pattern: weightOne null →
// bodyweight, weightTwo null → two-hand single, weightTwo 0 → single, else double.
const movement = (
  movementName: string,
  weightOne: number | null,
  weightTwo: number | null,
): MovementOptions => ({
  movementName,
  repScheme: [5],
  weightOneValue: weightOne,
  weightOneUnit: kg(weightOne),
  weightTwoValue: weightTwo,
  weightTwoUnit: weightTwo == null || weightTwo === 0 ? null : 'kilograms',
});

const session = (
  seq: number,
  movements: MovementOptions[],
  { complex = false }: { complex?: boolean } = {},
): ProgramSession => ({
  id: `s-${seq}`,
  programId: 'p',
  sequenceIndex: seq,
  weekNumber: 1,
  dayNumber: 1,
  title: 't',
  notes: null,
  weightLabel: null,
  workoutOptions: {
    workoutMode: complex ? ('complex' as const) : ('circuit' as const),
    intervalTimer: 0,
    restTimer: 0,
    title: null,
    preWorkoutNotes: null,
    workoutGoal: 0,
    workoutGoalUnits: 'minutes',
    sharedWeightOneValue: null,
    sharedWeightOneUnit: null,
    sharedWeightTwoValue: null,
    sharedWeightTwoUnit: null,
    movements,
  },
});

describe('deriveMovementWeights', () => {
  it('returns one control per distinct movement, in first-appearance order', () => {
    const controls = deriveMovementWeights([
      session(0, [
        movement('Press', 24, 24),
        movement('Pull-Up', null, null),
        movement('Swing', 24, null),
      ]),
    ]);

    expect(controls.map((c) => c.movementName)).toEqual([
      'Press',
      'Pull-Up',
      'Swing',
    ]);
  });

  it('derives the config mode from each movement’s null-pattern', () => {
    const controls = deriveMovementWeights([
      session(0, [
        movement('Double', 24, 24),
        movement('Body', null, null),
        movement('TwoHand', 24, null),
        movement('Single', 24, 0),
      ]),
    ]);

    expect(controls.map((c) => c.mode)).toEqual(['double', 'none', '2h', '1h']);
  });

  it('pre-fills a bodyweight movement with all-null weights', () => {
    const [control] = deriveMovementWeights([
      session(0, [movement('Pull-Up', null, null)]),
    ]);

    expect(control.mode).toBe('none');
    expect(control.modalWeight).toEqual({
      sharedWeightOneValue: null,
      sharedWeightOneUnit: null,
      sharedWeightTwoValue: null,
      sharedWeightTwoUnit: null,
    });
  });

  it('picks the most common authored weight as the movement’s modal', () => {
    // Two working days at 24, one test day at 28 → modal 24.
    const [press] = deriveMovementWeights([
      session(0, [movement('Press', 24, 24)]),
      session(1, [movement('Press', 24, 24)]),
      session(2, [movement('Press', 28, 28)]),
    ]);

    expect(press.modalWeight.sharedWeightOneValue).toBe(24);
    expect(press.modalWeight.sharedWeightTwoValue).toBe(24);
  });

  it('breaks a modal tie toward the lighter weight', () => {
    // Equal counts of 20 and 28 → the lighter 20 wins, mirroring the RPC.
    const [swing] = deriveMovementWeights([
      session(0, [movement('Swing', 28, 0)]),
      session(1, [movement('Swing', 20, 0)]),
    ]);

    expect(swing.modalWeight.sharedWeightOneValue).toBe(20);
  });

  it('keeps a single-bell movement’s weight two shape in its modal', () => {
    const [swing] = deriveMovementWeights([
      session(0, [movement('Swing', 24, null)]),
    ]);

    expect(swing.mode).toBe('2h');
    expect(swing.modalWeight.sharedWeightTwoValue).toBeNull();
  });
});

describe('isComplexProgram', () => {
  it('is true when any session is a complex set', () => {
    expect(
      isComplexProgram([
        session(0, [movement('Clean', 24, 24)], { complex: true }),
      ]),
    ).toBe(true);
  });

  it('is false when no session is a complex set', () => {
    expect(isComplexProgram([session(0, [movement('Press', 24, 24)])])).toBe(
      false,
    );
  });
});
