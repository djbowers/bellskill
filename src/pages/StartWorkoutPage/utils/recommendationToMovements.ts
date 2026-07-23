import type {
  Movement,
  MovementOptions,
  Recommendation,
  WorkoutOptions,
} from '~/types';
import {
  type MovementWeightModeFields,
  movementMatchesWeightMode,
} from '~/utils';

/** Catalog weight-mode metadata keyed by canonical movement name. */
export type RecommendationCatalog = ReadonlyMap<
  string,
  MovementWeightModeFields
>;

/**
 * Builds the name→metadata lookup the recommender maps against. A single catalog
 * page is meant to hold every movement; if the source query reports another page
 * (`hasNextPage`), movements past page one are absent from the map and silently
 * fall back to 2H — the exact silent-revert PROD-238 killed — so warn loudly.
 */
export const buildRecommendationCatalog = (
  movements: Movement[],
  hasNextPage = false,
): RecommendationCatalog => {
  if (hasNextPage) {
    console.warn(
      'movement catalog exceeded MOVEMENT_CATALOG_PAGE_SIZE; recommended weight-mode inference may be incomplete',
    );
  }
  const entries: [string, Movement][] = [];
  for (const movement of movements) {
    if (movement.movementName) entries.push([movement.movementName, movement]);
  }
  return new Map(entries);
};

// Fills the second weight slot from catalog metadata so the builder opens in the
// loading mode the movement implies (getWeightTabValue): a genuine two-bell
// movement carries the prescribed load (Double), a single-arm movement pins it
// to 0 (1H), and everything else stays unset (2H, the pre-catalog default).
const inferSecondWeight = (
  fields: MovementWeightModeFields | undefined,
  weightKg: number,
): Pick<MovementOptions, 'weightTwoUnit' | 'weightTwoValue'> => {
  if (fields && movementMatchesWeightMode(fields, 'double')) {
    return { weightTwoUnit: 'kilograms', weightTwoValue: weightKg };
  }
  if (fields && movementMatchesWeightMode(fields, '1h')) {
    return { weightTwoUnit: null, weightTwoValue: 0 };
  }
  return { weightTwoUnit: null, weightTwoValue: null };
};

/**
 * Maps a recommendation's blocks onto the app's MovementOptions. The recommender
 * prescribes a single weight in kilograms per movement, which becomes weight one;
 * the second weight slot is inferred from the movement's catalog metadata so
 * two-bell movements open as Double rather than defaulting to two-hand.
 */
export const recommendationToMovements = (
  recommendation: Recommendation,
  catalog?: RecommendationCatalog,
): MovementOptions[] =>
  recommendation.blocks.map((block) => ({
    movementName: block.movement_name,
    repScheme: block.rep_scheme,
    weightOneUnit: 'kilograms',
    weightOneValue: block.weight_kg,
    ...inferSecondWeight(catalog?.get(block.movement_name), block.weight_kg),
  }));

/**
 * Maps a recommendation onto a full set of workout options ready to load into
 * the builder. Duration becomes a time goal; timers, complex mode, and shared
 * weights default off for the user to add if they want.
 */
export const recommendationToWorkoutOptions = (
  recommendation: Recommendation,
  catalog?: RecommendationCatalog,
): Omit<WorkoutOptions, 'startedAt'> => ({
  complexSet: false,
  intervalTimer: 0,
  movements: recommendationToMovements(recommendation, catalog),
  restTimer: 0,
  sharedWeightOneUnit: null,
  sharedWeightOneValue: null,
  sharedWeightTwoUnit: null,
  sharedWeightTwoValue: null,
  title: null,
  preWorkoutNotes: null,
  workoutGoal: recommendation.duration_minutes,
  workoutGoalUnits: 'minutes',
});
