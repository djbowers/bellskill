import { WorkoutLog } from '~/types';
import { toWorkoutMode } from '~/utils';

import type { Database } from '../../types/supabase';

type WorkoutLogRow = Database['public']['Tables']['workout_logs']['Row'];

/**
 * camelCase mapper for a raw `workout_logs` row.
 *
 * `workout_mode` / `shared_bell` are nullable while pre-split clients are still
 * writing only `complex_set` / `straight_sets`, so both fall back to the boolean
 * pair. A trigger keeps the two representations in sync, making the fallback
 * belt-and-braces rather than load-bearing — but rows written between the deploy
 * and the migration would otherwise read as circuit.
 */
export const mapWorkoutLogRow = (row: WorkoutLogRow): WorkoutLog => ({
  completedAt: new Date(row.completed_at),
  completedReps: row.completed_reps,
  completedRounds: row.completed_rounds,
  completedRungs: row.completed_rungs,
  completedSides: row.completed_sides,
  completedVolume: row.completed_volume,
  id: row.id,
  intervalTimer: row.interval_timer,
  movements: row.movements,
  restTimer: row.rest_timer,
  rpe: row.rpe,
  sharedWeightOneUnit: row.shared_weight_one_unit,
  sharedWeightOneValue: row.shared_weight_one_value,
  sharedWeightTwoUnit: row.shared_weight_two_unit,
  sharedWeightTwoValue: row.shared_weight_two_value,
  startedAt: new Date(row.started_at),
  workoutMode:
    (row.workout_mode as WorkoutLog['workoutMode'] | null) ??
    toWorkoutMode(row.complex_set, row.straight_sets),
  sharedBell: row.shared_bell ?? row.complex_set,
  title: row.title,
  preWorkoutNotes: row.pre_workout_notes,
  workoutGoal: row.workout_goal,
  workoutGoalUnits: row.workout_goal_units,
  postWorkoutNotes: row.post_workout_notes,
});
