import { useMutation } from 'react-query';

import { useSession, useWorkoutOptions } from '~/contexts';
import { WorkoutOptions } from '~/types';

import { supabase } from '../supabaseClient';

interface LogWorkoutInput {
  completedReps: number;
  completedRounds: number;
  completedRungs: number;
  completedVolume: number;
}

export const useLogWorkout = () => {
  const [workoutOptions] = useWorkoutOptions();
  const { user } = useSession();

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
    startedAt,
    workoutDetails,
    workoutGoal,
    workoutGoalUnits,
  } = workoutOptions;

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
