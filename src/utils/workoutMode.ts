import { WorkoutMode } from '~/types';

export const WORKOUT_MODE_LABELS: Record<WorkoutMode, string> = {
  circuit: 'Circuit',
  straightSets: 'Straight Sets',
  complex: 'Complex',
};

/**
 * The persisted shape of a workout mode: `workout_logs.complex_set` /
 * `.straight_sets`, and the matching camelCase keys inside the
 * `program_sessions.workout_options` JSONB.
 */
export interface PersistedWorkoutMode {
  complexSet: boolean;
  straightSets: boolean;
}

/**
 * Read a persisted boolean pair as a {@link WorkoutMode}. Complex wins if both
 * are somehow true — the builder has always kept them mutually exclusive, so a
 * both-true row is corrupt rather than meaningful.
 *
 * This and {@link fromWorkoutMode} are the only places outside the API boundary
 * mappers that may mention the two booleans.
 */
export const toWorkoutMode = (
  complexSet?: boolean | null,
  straightSets?: boolean | null,
): WorkoutMode =>
  complexSet ? 'complex' : straightSets ? 'straightSets' : 'circuit';

/** Write a {@link WorkoutMode} back out as the persisted boolean pair. */
export const fromWorkoutMode = (mode: WorkoutMode): PersistedWorkoutMode => ({
  complexSet: mode === 'complex',
  straightSets: mode === 'straightSets',
});
