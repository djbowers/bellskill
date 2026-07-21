import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { WorkoutLog } from '~/types';

import { supabase } from '../supabaseClient';

export const useSelectRPE = (workoutLogId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (selectedRpe: WorkoutLog['rpe']) => {
      return updateWorkoutLog(selectedRpe, workoutLogId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERIES.WORKOUT_LOG] });
    },
  });
};

const updateWorkoutLog = async (
  selectedRpe: WorkoutLog['rpe'],
  workoutLogId: string,
) => {
  const { error } = await supabase
    .from('workout_logs')
    .update({ rpe: selectedRpe })
    .eq('id', parseInt(workoutLogId));

  if (error) {
    console.error(error);
    throw error;
  }
};
