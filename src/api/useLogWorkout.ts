import { useMutation, useQueryClient } from 'react-query';

import { QUERIES } from '~/constants';
import { useSession, useWorkoutOptions } from '~/contexts';
import { WorkoutLog, WorkoutOptions } from '~/types';

import { supabase } from '../supabaseClient';
import { AnalyticsEvent, trackEvent } from './analytics';

interface LogWorkoutInput {
  completedReps: number;
  completedRounds: number;
  completedRungs: number;
  completedVolume: number;
}

export const useLogWorkout = () => {
  const [workoutOptions] = useWorkoutOptions();
  const { user } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      completedReps,
      completedRounds,
      completedRungs,
      completedVolume,
    }: LogWorkoutInput) =>
      logWorkout({
        completedReps,
        completedRounds,
        completedRungs,
        completedVolume,
        userId: user.id,
        workoutOptions,
      }),
    onSuccess: (workoutLogId) => {
      // Activation funnel (PROD-157). is_first_workout is read from the
      // WORKOUT_LOGS cache, warmed by StartWorkoutPage before the user reaches
      // the active workout; the canonical value is also derivable server-side
      // from workout_logs (see the user_activation view).
      const cachedLogs = queryClient.getQueryData<WorkoutLog[]>(
        QUERIES.WORKOUT_LOGS,
      );
      const completedAt = Date.now();
      const startedAtMs = workoutOptions.startedAt?.getTime();
      const signupAtMs = user.created_at ? Date.parse(user.created_at) : NaN;

      void trackEvent({
        event: AnalyticsEvent.WorkoutCompleted,
        userId: user.id,
        properties: {
          workout_log_id: workoutLogId,
          is_first_workout: cachedLogs?.length === 0,
          duration_seconds:
            startedAtMs != null
              ? Math.round((completedAt - startedAtMs) / 1000)
              : null,
          seconds_since_signup: Number.isNaN(signupAtMs)
            ? null
            : Math.round((completedAt - signupAtMs) / 1000),
        },
      });
    },
  });
};

const logWorkout = async ({
  completedReps,
  completedRounds,
  completedRungs,
  completedVolume,
  userId,
  workoutOptions,
}: {
  completedReps: number;
  completedRounds: number;
  completedRungs: number;
  completedVolume: number;
  userId: string;
  workoutOptions: WorkoutOptions;
}) => {
  const {
    complexSet,
    intervalTimer,
    movements,
    restTimer,
    sharedWeightOneUnit,
    sharedWeightOneValue,
    sharedWeightTwoUnit,
    sharedWeightTwoValue,
    startedAt,
    workoutDetails,
    workoutGoal,
    workoutGoalUnits,
  } = workoutOptions;

  const { data: userMovements } = await supabase
    .from('user_movements')
    .select('id, canonical_name')
    .eq('user_id', userId)
    .in(
      'canonical_name',
      movements.map((m) => m.movementName),
    );

  const userMovementIdByName = Object.fromEntries(
    (userMovements ?? []).map((um) => [um.canonical_name, um.id]),
  );

  const { error, data: workoutLogs } = await supabase
    .from('workout_logs')
    .insert({
      completed_at: new Date().toISOString(),
      completed_reps: completedReps,
      completed_rounds: completedRounds,
      completed_rungs: completedRungs,
      completed_volume: completedVolume,
      complex_set: complexSet,
      interval_timer: intervalTimer,
      movements: movements.map((movement) => movement.movementName),
      rest_timer: restTimer,
      shared_weight_one_unit: sharedWeightOneUnit,
      shared_weight_one_value: sharedWeightOneValue,
      shared_weight_two_unit: sharedWeightTwoUnit,
      shared_weight_two_value: sharedWeightTwoValue,
      started_at: (startedAt ?? new Date()).toISOString(),
      user_id: userId,
      workout_details: workoutDetails,
      workout_goal: workoutGoal,
      workout_goal_units: workoutGoalUnits,
    })
    .select('id');

  if (error) {
    console.error(error);
    throw error;
  }

  const workoutLogId = workoutLogs[0].id;

  const { error: movementLogError } = await supabase
    .from('movement_logs')
    .insert(
      movements.map((movement) => ({
        movement_name: movement.movementName,
        user_movement_id: userMovementIdByName[movement.movementName] ?? null,
        rep_scheme: movement.repScheme,
        weight_one_unit: movement.weightOneUnit,
        weight_one_value: movement.weightOneValue,
        weight_two_unit: movement.weightTwoUnit,
        weight_two_value: movement.weightTwoValue,
        user_id: userId,
        workout_log_id: workoutLogId,
      })),
    );

  if (movementLogError) {
    console.error(movementLogError);
    throw movementLogError;
  }

  return workoutLogId;
};
