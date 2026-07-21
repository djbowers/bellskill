import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';

import { supabase } from '../supabaseClient';

export const useDeleteWorkoutLog = (workoutLogId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteWorkoutLog(workoutLogId),
    onSuccess: () =>
      queryClient.refetchQueries({ queryKey: [QUERIES.WORKOUT_LOGS] }),
  });
};

const deleteWorkoutLog = async (workoutLogId: string) => {
  const { data: workoutLogs, error } = await supabase
    .from('workout_logs')
    .delete()
    .eq('id', parseInt(workoutLogId))
    .select();

  if (error) {
    console.error('Error deleting workout log:', error);
    throw error;
  }

  if (workoutLogs.length === 0) {
    console.warn('No workout log found with the specified ID.');
    return null;
  }

  console.log('Workout log deleted successfully.');
  return workoutLogs[0].id;
};
