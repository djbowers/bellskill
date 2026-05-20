import { useQuery } from 'react-query';

import { QUERIES } from '~/constants';
import { WorkoutLog } from '~/types';

import { supabase } from '../supabaseClient';

export const useWorkoutLog = (id: string) => {
  return useQuery([QUERIES.WORKOUT_LOG, id], () => fetchWorkoutLog(id));
};

const fetchWorkoutLog = async (id: string): Promise<WorkoutLog> => {
  const { data: workoutLog, error } = await supabase
    .from('workout_logs')
    .select(`*`)
    .eq('id', parseInt(id))
    .maybeSingle();

  if (error) {
    console.error(error);
    throw error;
  }

  if (!workoutLog) {
    throw Error('Unable to fetch workout log data for id: ' + id);
  }

  return {
    completedAt: new Date(workoutLog.completed_at),
    completedReps: workoutLog.completed_reps,
    completedRounds: workoutLog.completed_rounds,
    completedRungs: workoutLog.completed_rungs,
    completedVolume: workoutLog.completed_volume,
    complexSet: workoutLog.complex_set,
    id: workoutLog.id,
    intervalTimer: workoutLog.interval_timer,
    movements: workoutLog.movements,
    restTimer: workoutLog.rest_timer,
    rpe: workoutLog.rpe,
    startedAt: new Date(workoutLog.started_at),
    workoutDetails: workoutLog.workout_details,
    workoutGoal: workoutLog.workout_goal,
    workoutGoalUnits: workoutLog.workout_goal_units,
    workoutNotes: workoutLog.workout_notes,
  };
};
