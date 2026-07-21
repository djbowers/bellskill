import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { signOutIfStaleAuthUser } from '~/utils';

import { supabase } from '../supabaseClient';

export interface UnlinkMovementLogInput {
  movementLogId: number;
}

export const unlinkMovementLog = async ({
  movementLogId,
}: UnlinkMovementLogInput) => {
  const { error } = await supabase
    .from('movement_logs')
    .update({ user_movement_id: null })
    .eq('id', movementLogId);

  if (error) {
    if (await signOutIfStaleAuthUser(error)) {
      return;
    }
    throw error;
  }
};

export const useUnlinkMovementLog = (workoutLogId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: unlinkMovementLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERIES.MOVEMENT_LOGS] });
      queryClient.invalidateQueries({
        queryKey: [QUERIES.WORKOUT_LOG, String(workoutLogId)],
      });
      queryClient.invalidateQueries({ queryKey: [QUERIES.WORKOUT_LOGS] });
      queryClient.invalidateQueries({ queryKey: [QUERIES.USER_MOVEMENTS] });
    },
  });
};
