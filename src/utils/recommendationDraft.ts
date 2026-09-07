// Recommendation → WorkoutDraft, shared by the app and the edge function.
//
// Every recommended session is a circuit timed by duration_minutes, so the
// recommender's validator and the builder's mapper agree on the mode by
// construction. They live here together so the mapping can't drift the way the
// two validators did (PROD-240).
//
// Dependency-free (relative `.ts` imports only) so the Deno edge runtime can
// import it alongside validateWorkout.ts.

import type { WorkoutGoalUnits } from '../types/workout-goal-units.type.ts';
import type { WorkoutDraft } from './validateWorkout.ts';

/** The only arrangement the LLM may declare. Mirrors RECOMMENDATION_SCHEMA's enum. */
export type RecommendationFormat = 'Circuit';

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

/** A circuit runs on the clock: the recommended duration is the goal. */
export const recommendationGoal = (
  recommendation: RecommendationLike,
): { workoutGoal: number; workoutGoalUnits: WorkoutGoalUnits } => ({
  workoutGoal: recommendation.duration_minutes,
  workoutGoalUnits: 'minutes',
});

/**
 * Adapts an LLM recommendation into the shared draft shape. The recommender has
 * no timers and prescribes one weight in kg per movement, which becomes weight
 * one. `weight_kg` is a required number in the schema, so a recommended movement
 * is never bodyweight (see the spec's out-of-scope note).
 */
export const recommendationToDraft = (
  recommendation: RecommendationLike,
): WorkoutDraft => ({
  workoutMode: 'circuit',
  workoutGoal: recommendationGoal(recommendation).workoutGoal,
  intervalTimer: 0,
  movements: recommendation.blocks.map((block) => ({
    movementName: block.movement_name,
    repScheme: block.rep_scheme,
    weightOneValue: block.weight_kg,
  })),
});
