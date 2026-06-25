import { getWeightTabValue } from '~/utils';

import { CURATED_WORKOUTS, CURATED_WORKOUTS_VERSION } from './curatedWorkouts';

describe('CURATED_WORKOUTS', () => {
  test('exports a numeric version', () => {
    expect(typeof CURATED_WORKOUTS_VERSION).toBe('number');
    expect(CURATED_WORKOUTS_VERSION).toBeGreaterThanOrEqual(1);
  });

  test('provides 2-3 beginner options with unique ids', () => {
    expect(CURATED_WORKOUTS.length).toBeGreaterThanOrEqual(2);
    expect(CURATED_WORKOUTS.length).toBeLessThanOrEqual(3);
    const ids = CURATED_WORKOUTS.map((workout) => workout.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test.each(CURATED_WORKOUTS)(
    '$id is a valid, startable single-bell session',
    (workout) => {
      const { workoutOptions } = workout;

      // Beginner-friendly: simple, no complex sets.
      expect(workoutOptions.complexSet).toBe(false);
      expect(workoutOptions.sharedWeightOneValue).toBeNull();
      expect(workoutOptions.intervalTimer).toBe(0);
      expect(workoutOptions.workoutGoal).toBeGreaterThan(0);

      expect(workoutOptions.movements.length).toBeGreaterThan(0);
      for (const movement of workoutOptions.movements) {
        expect(movement.movementName.length).toBeGreaterThan(0);
        expect(movement.repScheme.length).toBeGreaterThan(0);
        expect(movement.repScheme.every((reps) => reps > 0)).toBe(true);
      }

      expect(workout.title.length).toBeGreaterThan(0);
      expect(workout.subtitle.length).toBeGreaterThan(0);
      expect(workout.estimatedMinutes).toBeGreaterThan(0);
    },
  );

  test('encodes weight modes the same way the builder would', () => {
    const byId = Object.fromEntries(CURATED_WORKOUTS.map((w) => [w.id, w]));

    expect(
      getWeightTabValue(
        byId['beginner-two-hand-swing'].workoutOptions.movements[0],
      ),
    ).toBe('2h');
    expect(
      getWeightTabValue(
        byId['beginner-goblet-squat'].workoutOptions.movements[0],
      ),
    ).toBe('2h');
    expect(
      getWeightTabValue(
        byId['beginner-overhead-press'].workoutOptions.movements[0],
      ),
    ).toBe('1h');
  });

  test('the swing template equals a hand-built equivalent', () => {
    const swing = CURATED_WORKOUTS.find(
      (workout) => workout.id === 'beginner-two-hand-swing',
    );

    expect(swing?.workoutOptions).toEqual({
      complexSet: false,
      intervalTimer: 0,
      restTimer: 60,
      movements: [
        {
          movementName: 'Kettlebell Swing',
          repScheme: [10],
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
      workoutDetails: 'Two-Hand Swing',
      workoutGoal: 5,
      workoutGoalUnits: 'rounds',
    });
  });
});
