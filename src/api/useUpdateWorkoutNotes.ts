import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { WorkoutLog } from '~/types';

import { supabase } from '../supabaseClient';

export const useUpdateWorkoutNotes = (workoutLogId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workoutNotes: WorkoutLog['workoutNotes']) => {
      return updateWorkoutLog(workoutNotes, workoutLogId);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: [QUERIES.WORKOUT_LOG] });
    },
  });
};

const updateWorkoutLog = async (
  workoutNotes: WorkoutLog['workoutNotes'],
  workoutLogId: string,
) => {
  const { error } = await supabase
    .from('workout_logs')
    .update({ workout_notes: workoutNotes })
    .eq('id', parseInt(workoutLogId));

  if (error) {
    console.error(error);
    throw error;
  }
};
