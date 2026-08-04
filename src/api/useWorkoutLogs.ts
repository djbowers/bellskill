import { useQuery } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { WorkoutLog } from '~/types';
import { toWorkoutMode } from '~/utils';

import { supabase } from '../supabaseClient';

export const useWorkoutLogs = () => {
  return useQuery({
    queryKey: [QUERIES.WORKOUT_LOGS],
    queryFn: fetchWorkoutLogs,
  });
};

const fetchWorkoutLogs = async (): Promise<WorkoutLog[]> => {
  const { data: workoutLogs, error } = await supabase
    .from('workout_logs')
    .select(`*`);

  if (error) {
    console.error(error);
    throw error;
  }

  return workoutLogs.map((workoutLog) => ({
    completedAt: new Date(workoutLog.completed_at),
    completedReps: workoutLog.completed_reps,
    completedRounds: workoutLog.completed_rounds,
    completedRungs: workoutLog.completed_rungs,
    completedSides: workoutLog.completed_sides,
    completedVolume: workoutLog.completed_volume,
    id: workoutLog.id,
    intervalTimer: workoutLog.interval_timer,
    movements: workoutLog.movements,
    restTimer: workoutLog.rest_timer,
    rpe: workoutLog.rpe,
    sharedWeightOneUnit: workoutLog.shared_weight_one_unit,
    sharedWeightOneValue: workoutLog.shared_weight_one_value,
    sharedWeightTwoUnit: workoutLog.shared_weight_two_unit,
    sharedWeightTwoValue: workoutLog.shared_weight_two_value,
    startedAt: new Date(workoutLog.started_at),
    workoutMode: toWorkoutMode(
      workoutLog.complex_set,
      workoutLog.straight_sets,
    ),
    title: workoutLog.title,
    preWorkoutNotes: workoutLog.pre_workout_notes,
    workoutGoal: workoutLog.workout_goal,
    workoutGoalUnits: workoutLog.workout_goal_units,
    postWorkoutNotes: workoutLog.post_workout_notes,
  }));
};
