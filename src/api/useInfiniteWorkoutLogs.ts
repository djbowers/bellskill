import { useInfiniteQuery } from 'react-query';

import { QUERIES } from '~/constants';
import { WorkoutLog } from '~/types';

import { supabase } from '../supabaseClient';

const PAGE_SIZE = 20;

interface WorkoutLogsPage {
  workoutLogs: WorkoutLog[];
  nextPage: number | undefined;
}

export const useInfiniteWorkoutLogs = () =>
  useInfiniteQuery(QUERIES.WORKOUT_LOGS_INFINITE, fetchWorkoutLogsPage, {
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });

const fetchWorkoutLogsPage = async ({
  pageParam = 1,
}): Promise<WorkoutLogsPage> => {
  const from = (pageParam - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count, error } = await supabase
    .from('workout_logs')
    .select('*', { count: 'exact' })
    .order('started_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error(error);
    throw error;
  }

  const totalCount = count ?? 0;
  const nextPage = to < totalCount - 1 ? pageParam + 1 : undefined;

  return {
    nextPage,
    workoutLogs: data.map((workoutLog) => ({
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
      sharedWeightOneUnit: workoutLog.shared_weight_one_unit,
      sharedWeightOneValue: workoutLog.shared_weight_one_value,
      sharedWeightTwoUnit: workoutLog.shared_weight_two_unit,
      sharedWeightTwoValue: workoutLog.shared_weight_two_value,
      startedAt: new Date(workoutLog.started_at),
      workoutDetails: workoutLog.workout_details,
      workoutGoal: workoutLog.workout_goal,
      workoutGoalUnits: workoutLog.workout_goal_units,
      workoutNotes: workoutLog.workout_notes,
    })),
  };
};
