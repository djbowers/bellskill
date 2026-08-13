/**
 * How a workout's movements are arranged. Arrangement only — which bell each
 * movement is loaded with is the separate `sharedBell` axis (`usesSharedBell`).
 *
 * - `circuit` — rotate through the movements, one rung each, little rest.
 * - `straightSets` — finish every rung of a movement before the next starts.
 * - `complex` — one bell held through every movement, back to back. Because the
 *   bell never goes down, complex forces `sharedBell` on.
 *
 * Persisted as `workout_logs.workout_mode`, with the legacy `complex_set` /
 * `straight_sets` pair kept in sync until cached clients cycle.
 */
export type WorkoutMode = 'circuit' | 'straightSets' | 'complex';

export const DEFAULT_WORKOUT_MODE: WorkoutMode = 'circuit';
