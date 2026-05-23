import { useMutation, useQueryClient } from 'react-query';

import { QUERIES } from '~/constants';
import { useSession } from '~/contexts';
import { signOutIfStaleAuthUser } from '~/utils';

import { supabase } from '../supabaseClient';
import { createOrReuseUserMovement } from './userMovement';

export interface LinkMovementLogInput {
  workoutLogId: number;
  movementLogId: number;
  movementIndex: number;
  canonicalName: string;
  functionalMovementId?: string | null;
}

export const linkMovementLog = async ({
  userId,
  workoutLogId,
  movementLogId,
  movementIndex,
  canonicalName,
  functionalMovementId,
}: LinkMovementLogInput & { userId: string }) => {
  const userMovement = await createOrReuseUserMovement({
    userId,
    canonicalName,
    functionalMovementId,
  });

  if (!userMovement) {
    throw new Error('Unable to link movement');
  }

  const { error: movementLogError } = await supabase
    .from('movement_logs')
    .update({
      movement_name: canonicalName,
      user_movement_id: userMovement.id,
    })
    .eq('id', movementLogId);

  if (movementLogError) {
    if (await signOutIfStaleAuthUser(movementLogError)) {
      return;
    }
    throw movementLogError;
  }

  const { data: workoutLog, error: fetchError } = await supabase
    .from('workout_logs')
    .select('movements')
    .eq('id', workoutLogId)
    .single();

  if (fetchError) {
    if (await signOutIfStaleAuthUser(fetchError)) {
      return;
    }
    throw fetchError;
  }

  const updatedMovements = [...(workoutLog.movements ?? [])];
  updatedMovements[movementIndex] = canonicalName;

  const { error: workoutUpdateError } = await supabase
    .from('workout_logs')
    .update({ movements: updatedMovements })
    .eq('id', workoutLogId);

  if (workoutUpdateError) {
    if (await signOutIfStaleAuthUser(workoutUpdateError)) {
      return;
    }
    throw workoutUpdateError;
  }
};

export const useLinkMovementLog = (workoutLogId: number) => {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session?.user?.id;

  return useMutation({
    mutationFn: (input: Omit<LinkMovementLogInput, 'workoutLogId'>) => {
      if (!userId) return Promise.resolve();
      return linkMovementLog({ ...input, workoutLogId, userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries([QUERIES.MOVEMENT_LOGS]);
      queryClient.invalidateQueries([QUERIES.WORKOUT_LOG, String(workoutLogId)]);
      queryClient.invalidateQueries([QUERIES.WORKOUT_LOGS]);
      queryClient.invalidateQueries([QUERIES.USER_MOVEMENTS]);
    },
  });
};
