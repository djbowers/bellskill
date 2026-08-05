// Recommendation → WorkoutDraft, shared by the app and the edge function.
//
// The format-to-mode mapping is a runnability rule: only Straight Sets exempts a
// session from the equal-rungs check, so the recommender's validator and the
// builder's mapper have to agree on it. They live here together so the mapping
// can't drift the way the two validators did (PROD-240).
//
// Dependency-free (relative `.ts` imports only) so the Deno edge runtime can
// import it alongside validateWorkout.ts.

import type { WorkoutMode } from '../types/workout-mode.type.ts';
import type { WorkoutDraft } from './validateWorkout.ts';

/** The arrangements the LLM may declare. Mirrors RECOMMENDATION_SCHEMA's enum. */
export type RecommendationFormat =
  | 'EMOM'
  | 'AMRAP'
  | 'Circuit'
  | 'Ladder'
  | 'Straight Sets';

/**
 * The arrangement the recommender declared, mapped onto the builder's modes.
 * Complex is never inferred — it needs a shared bell the recommender doesn't
 * prescribe.
 */
export const FORMAT_WORKOUT_MODES: Record<RecommendationFormat, WorkoutMode> = {
  'Straight Sets': 'straightSets',
  Circuit: 'circuit',
  EMOM: 'circuit',
  AMRAP: 'circuit',
  Ladder: 'circuit',
};

export const formatToWorkoutMode = (format: string): WorkoutMode =>
  FORMAT_WORKOUT_MODES[format as RecommendationFormat] ?? 'circuit';

/** The snake_case wire shape both `Recommendation` declarations satisfy. */
export interface RecommendationLike {
  duration_minutes: number;
  format: string;
  blocks: ReadonlyArray<{
    movement_name: string;
    weight_kg: number;
    rep_scheme: number[];
  }>;
}

/**
 * Adapts an LLM recommendation into the shared draft shape. The recommender has
 * no timers and prescribes one weight in kg per movement, which becomes weight
 * one. `weight_kg` is a required number in the schema, so a recommended movement
 * is never bodyweight (see the spec's out-of-scope note).
 */
export const recommendationToDraft = (
  recommendation: RecommendationLike,
): WorkoutDraft => ({
  workoutMode: formatToWorkoutMode(recommendation.format),
  workoutGoal: recommendation.duration_minutes,
  intervalTimer: 0,
  movements: recommendation.blocks.map((block) => ({
    movementName: block.movement_name,
    repScheme: block.rep_scheme,
    weightOneValue: block.weight_kg,
  })),
});
