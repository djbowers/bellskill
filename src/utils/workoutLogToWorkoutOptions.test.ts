import { MovementLog, WorkoutLog } from '~/types';

import { workoutLogToWorkoutOptions } from './workoutLogToWorkoutOptions';

const baseWorkoutLog = (overrides: Partial<WorkoutLog> = {}): WorkoutLog => ({
  completedAt: new Date('2026-01-01T10:10:00.000Z'),
  completedReps: 0,
  completedRounds: 5,
  completedRungs: 5,
  completedSides: null,
  completedVolume: null,
  complexSet: false,
  id: 1,
  intervalTimer: 0,
  movements: [],
  restTimer: 60,
  rpe: null,
  sharedWeightOneUnit: null,
  sharedWeightOneValue: null,
  sharedWeightTwoUnit: null,
  sharedWeightTwoValue: null,
  startedAt: new Date('2026-01-01T10:00:00.000Z'),
  title: 'Morning swings',
  preWorkoutNotes: null,
  workoutGoal: 5,
  workoutGoalUnits: 'rounds',
  postWorkoutNotes: null,
  ...overrides,
});

const movementLog = (overrides: Partial<MovementLog> = {}): MovementLog => ({
  id: 1,
  movementName: 'Kettlebell Swing',
  repScheme: [10],
  userMovementId: null,
  functionalMovementId: null,
  weightOneUnit: 'kilograms',
  weightOneValue: 16,
  weightTwoUnit: null,
  weightTwoValue: null,
  ...overrides,
});

describe('workoutLogToWorkoutOptions', () => {
  test('maps a non-complex workout, using per-movement weights', () => {
    const result = workoutLogToWorkoutOptions(baseWorkoutLog(), [
      movementLog(),
    ]);

    expect(result).toEqual({
      complexSet: false,
      intervalTimer: 0,
      restTimer: 60,
      movements: [
        {
          movementName: 'Kettlebell Swing',
          repScheme: [10],
          timedRungs: false,
          weightOneUnit: 'kilograms',
          weightOneValue: 16,
          weightTwoUnit: null,
          weightTwoValue: null,
        },
      ],
      sharedWeightOneUnit: null,
      sharedWeightOneValue: null,
      sharedWeightTwoUnit: null,
      sharedWeightTwoValue: null,
      title: 'Morning swings',
      preWorkoutNotes: null,
      workoutGoal: 5,
      workoutGoalUnits: 'rounds',
      previousVolume: undefined,
      previousMinutes: 10,
      previousRounds: 5,
    });
  });

  test('omits startedAt so the caller can stamp it at start time', () => {
    const result = workoutLogToWorkoutOptions(baseWorkoutLog(), [
      movementLog(),
    ]);
    expect('startedAt' in result).toBe(false);
  });

  test('carries previousVolume only for kilogram-goal workouts', () => {
    const result = workoutLogToWorkoutOptions(
      baseWorkoutLog({ workoutGoalUnits: 'kilograms', completedVolume: 800 }),
      [movementLog()],
    );
    expect(result.previousVolume).toBe(800);
    expect(result.workoutGoalUnits).toBe('kilograms');
  });

  test('applies shared weights to every movement for complex workouts', () => {
    const result = workoutLogToWorkoutOptions(
      baseWorkoutLog({
        complexSet: true,
        sharedWeightOneUnit: 'kilograms',
        sharedWeightOneValue: 24,
      }),
      [
        movementLog({ movementName: 'Clean', weightOneValue: 16 }),
        movementLog({ id: 2, movementName: 'Front Squat', weightOneValue: 16 }),
      ],
    );

    expect(result.complexSet).toBe(true);
    expect(result.sharedWeightOneValue).toBe(24);
    expect(result.movements).toEqual([
      expect.objectContaining({
        movementName: 'Clean',
        weightOneValue: 24,
        weightOneUnit: 'kilograms',
      }),
      expect.objectContaining({
        movementName: 'Front Squat',
        weightOneValue: 24,
        weightOneUnit: 'kilograms',
      }),
    ]);
  });
});
