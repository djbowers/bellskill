import { useQuery } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { useSession } from '~/contexts';
import { RpeOptions, WeightUnit } from '~/types';

import { supabase } from '../supabaseClient';

/** One logged instance of a catalog movement, with its parent workout. */
export interface MovementHistoryEntry {
  movementLogId: number;
  workoutLogId: number;
  workoutTitle: string | null;
  startedAt: Date;
  rpe: RpeOptions | null;
  /** Reps per rung, or seconds per rung when `timedRungs` is set. */
  repScheme: number[];
  timedRungs: boolean;
  weightOneUnit: WeightUnit | null;
  weightOneValue: number | null;
  weightTwoUnit: WeightUnit | null;
  weightTwoValue: number | null;
}

/**
 * The signed-in user's full log history for one catalog movement, via their
 * user_movements links. RLS scopes rows to the current user.
 */
export const useMovementHistory = (functionalMovementId: string) => {
  const session = useSession();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: [QUERIES.MOVEMENT_HISTORY, userId, functionalMovementId],
    queryFn: () => fetchMovementHistory(functionalMovementId),
    enabled: functionalMovementId !== '' && !!userId,
  });
};

const fetchMovementHistory = async (
  functionalMovementId: string,
): Promise<MovementHistoryEntry[]> => {
  const { data: rows, error } = await supabase
    .from('movement_logs')
    .select(
      `id, rep_scheme, timed_rungs, workout_log_id,
       weight_one_unit, weight_one_value, weight_two_unit, weight_two_value,
       user_movements!inner(functional_movement_id),
       workout_logs!inner(started_at, title, rpe)`,
    )
    .eq('user_movements.functional_movement_id', functionalMovementId);

  if (error) {
    console.error(error);
    throw error;
  }

  return mapRows(rows).sort(
    (a, b) => b.startedAt.getTime() - a.startedAt.getTime(),
  );
};

const mapRows = (
  rows: {
    id: number;
    rep_scheme: number[];
    timed_rungs: boolean;
    workout_log_id: number;
    weight_one_unit: WeightUnit | null;
    weight_one_value: number | null;
    weight_two_unit: WeightUnit | null;
    weight_two_value: number | null;
    workout_logs:
      | { started_at: string; title: string | null; rpe: string | null }
      | { started_at: string; title: string | null; rpe: string | null }[];
  }[],
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
      weightOneUnit: row.weight_one_unit,
      weightOneValue: row.weight_one_value,
      weightTwoUnit: row.weight_two_unit,
      weightTwoValue: row.weight_two_value,
    };
  });
