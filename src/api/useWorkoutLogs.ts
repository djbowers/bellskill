import { useQuery } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { WorkoutLog } from '~/types';
import { supabase } from '../supabaseClient';
import { mapWorkoutLogRow } from './mapWorkoutLogRow';

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

  return workoutLogs.map(mapWorkoutLogRow);
};
