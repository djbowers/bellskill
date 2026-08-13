import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { supabase } from '~/supabaseClient';
import { MovementLog, WorkoutLog, WorkoutOptions } from '~/types';
import { workoutLogToWorkoutOptions } from '~/utils';

import { useWorkoutLogs } from './useWorkoutLogs';

export const RECENT_REPEAT_LIMIT = 3;

/** A past workout reduced to a one-tap startable session. */
export interface RepeatableWorkout {
  workoutLogId: number;
  workoutLog: WorkoutLog;
  workoutOptions: Omit<WorkoutOptions, 'startedAt'>;
}

const fetchMovementLogsByWorkoutIds = async (
  workoutLogIds: number[],
): Promise<Record<number, MovementLog[]>> => {
  if (workoutLogIds.length === 0) return {};

  const { data: rows, error } = await supabase
    .from('movement_logs')
    .select('*')
    .in('workout_log_id', workoutLogIds)
    .order('id');

  if (error) {
    console.error(error);
    throw error;
  }

  const grouped: Record<number, MovementLog[]> = {};
  for (const row of rows) {
    const movementLog: MovementLog = {
      id: row.id,
      movementName: row.movement_name,
      repScheme: row.rep_scheme,
      timedRungs: row.timed_rungs,
      maxReps: row.max_reps,
      completedRepScheme: row.completed_rep_scheme ?? undefined,
      userMovementId: row.user_movement_id ?? null,
      functionalMovementId: null,
      weightOneUnit: row.weight_one_unit,
      weightOneValue: row.weight_one_value,
      weightTwoUnit: row.weight_two_unit,
      weightTwoValue: row.weight_two_value,
    };
    (grouped[row.workout_log_id] ??= []).push(movementLog);
  }
  return grouped;
};

/**
 * The user's most recent completed workouts, each converted into a one-tap
 * startable session (via {@link workoutLogToWorkoutOptions}). Empty for users
 * with no history. Backs the "repeat a recent workout" recommendations that sit
 * alongside the curated first workouts on the Start page.
 */
export const useRecentRepeatableWorkouts = (
  limit: number = RECENT_REPEAT_LIMIT,
): { recentRepeats: RepeatableWorkout[]; isLoading: boolean } => {
  const { data: workoutLogs } = useWorkoutLogs();

  const recentLogs = useMemo(() => {
    if (!workoutLogs) return [];
    return [...workoutLogs]
      .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())
      .slice(0, limit);
  }, [workoutLogs, limit]);

  const workoutLogIds = recentLogs.map((log) => log.id);

  const { data: grouped, isLoading } = useQuery({
    queryKey: [QUERIES.MOVEMENT_LOGS, 'recent', workoutLogIds],
    queryFn: () => fetchMovementLogsByWorkoutIds(workoutLogIds),
    enabled: workoutLogIds.length > 0,
  });

  const recentRepeats = useMemo(() => {
    if (!grouped) return [];
    return recentLogs
      .map((log) => {
        const movementLogs = grouped[log.id] ?? [];
        if (movementLogs.length === 0) return null;
        return {
          workoutLogId: log.id,
          workoutLog: log,
          workoutOptions: workoutLogToWorkoutOptions(log, movementLogs),
        };
      })
      .filter((repeat): repeat is RepeatableWorkout => repeat !== null);
  }, [recentLogs, grouped]);

  return { recentRepeats, isLoading: workoutLogIds.length > 0 && isLoading };
};
