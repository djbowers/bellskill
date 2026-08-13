import { useQuery } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { WorkoutLog } from '~/types';
import { supabase } from '../supabaseClient';
import { mapWorkoutLogRow } from './mapWorkoutLogRow';

export const useWorkoutLog = (id: string) => {
  return useQuery({
    queryKey: [QUERIES.WORKOUT_LOG, id],
    queryFn: () => fetchWorkoutLog(id),
  });
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

  return mapWorkoutLogRow(workoutLog);
};
