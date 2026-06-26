import type { MovementOptions, Recommendation, WorkoutOptions } from '~/types';

/**
 * Maps a recommendation's blocks onto the app's MovementOptions. The recommender
 * prescribes a single weight in kilograms per movement, which becomes weight one;
 * the second weight slot is left unset for the user to fill if they want offset
 * or double-bell loading.
 */
export const recommendationToMovements = (
  recommendation: Recommendation,
): MovementOptions[] =>
  recommendation.blocks.map((block) => ({
    movementName: block.movement_name,
    repScheme: block.rep_scheme,
    weightOneUnit: 'kilograms',
    weightOneValue: block.weight_kg,
    weightTwoUnit: null,
    weightTwoValue: null,
  }));

/**
 * Maps a recommendation onto a full set of workout options ready to load into
 * the builder. Duration becomes a time goal; timers, complex mode, and shared
 * weights default off for the user to add if they want.
 */
export const recommendationToWorkoutOptions = (
  recommendation: Recommendation,
): Omit<WorkoutOptions, 'startedAt'> => ({
  complexSet: false,
  intervalTimer: 0,
  movements: recommendationToMovements(recommendation),
  restTimer: 0,
  sharedWeightOneUnit: null,
  sharedWeightOneValue: null,
  sharedWeightTwoUnit: null,
  sharedWeightTwoValue: null,
  workoutDetails: null,
  workoutGoal: recommendation.duration_minutes,
  workoutGoalUnits: 'minutes',
});
