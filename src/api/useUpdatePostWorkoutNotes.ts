import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { WorkoutLog } from '~/types';

import { supabase } from '../supabaseClient';

export const useUpdatePostWorkoutNotes = (workoutLogId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postWorkoutNotes: WorkoutLog['postWorkoutNotes']) => {
      return updateWorkoutLog(postWorkoutNotes, workoutLogId);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: [QUERIES.WORKOUT_LOG] });
    },
  });
};

const updateWorkoutLog = async (
  postWorkoutNotes: WorkoutLog['postWorkoutNotes'],
  workoutLogId: string,
) => {
  const { error } = await supabase
    .from('workout_logs')
    .update({ post_workout_notes: postWorkoutNotes })
    .eq('id', parseInt(workoutLogId));

  if (error) {
    console.error(error);
    throw error;
  }
};
