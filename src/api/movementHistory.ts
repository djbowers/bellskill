import { RpeOptions, WeightUnit } from '~/types';

/** One logged instance of a movement, with its parent workout. */
export interface MovementHistoryEntry {
  movementLogId: number;
  workoutLogId: number;
  workoutTitle: string | null;
  startedAt: Date;
  rpe: RpeOptions | null;
  /** Reps per rung, or seconds per rung when `timedRungs` is set. */
  repScheme: number[];
  timedRungs: boolean;
  /** Every rung was run once per leg. */
  unilateral: boolean;
  weightOneUnit: WeightUnit | null;
  weightOneValue: number | null;
  weightTwoUnit: WeightUnit | null;
  weightTwoValue: number | null;
}

/** The `movement_logs` columns a history list needs, plus its parent workout. */
export const MOVEMENT_HISTORY_SELECT = `id, rep_scheme, timed_rungs, unilateral, workout_log_id,
   weight_one_unit, weight_one_value, weight_two_unit, weight_two_value,
   workout_logs!inner(started_at, title, rpe)`;

export interface MovementHistoryRow {
  id: number;
  rep_scheme: number[];
  timed_rungs: boolean;
  unilateral: boolean;
  workout_log_id: number;
  weight_one_unit: WeightUnit | null;
  weight_one_value: number | null;
  weight_two_unit: WeightUnit | null;
  weight_two_value: number | null;
  workout_logs:
    | { started_at: string; title: string | null; rpe: string | null }
    | { started_at: string; title: string | null; rpe: string | null }[];
}

export const mapMovementHistoryRows = (
  rows: MovementHistoryRow[],
): MovementHistoryEntry[] =>
  rows.map((row) => {
    const workoutLog = Array.isArray(row.workout_logs)
      ? row.workout_logs[0]
      : row.workout_logs;

    return {
      movementLogId: row.id,
      workoutLogId: row.workout_log_id,
      workoutTitle: workoutLog?.title ?? null,
      startedAt: new Date(workoutLog?.started_at),
      rpe: (workoutLog?.rpe ?? null) as RpeOptions | null,
      repScheme: row.rep_scheme,
      timedRungs: row.timed_rungs,
      unilateral: row.unilateral ?? false,
      weightOneUnit: row.weight_one_unit,
      weightOneValue: row.weight_one_value,
      weightTwoUnit: row.weight_two_unit,
      weightTwoValue: row.weight_two_value,
    };
  });

export const byMostRecent = (
  a: MovementHistoryEntry,
  b: MovementHistoryEntry,
) => b.startedAt.getTime() - a.startedAt.getTime();
