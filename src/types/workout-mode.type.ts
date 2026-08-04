/**
 * How a workout's movements are arranged.
 *
 * - `circuit` — rotate through the movements, one rung each, little rest.
 * - `straightSets` — finish every rung of a movement before the next starts.
 * - `complex` — one bell held through every movement, back to back. Complex also
 *   implies the shared-bell weight model (see `resolveMovementWeights`).
 *
 * Persisted as the `complex_set` / `straight_sets` boolean pair; translate at the
 * API boundary with `toWorkoutMode` / `fromWorkoutMode`.
 */
export type WorkoutMode = 'circuit' | 'straightSets' | 'complex';

export const DEFAULT_WORKOUT_MODE: WorkoutMode = 'circuit';
