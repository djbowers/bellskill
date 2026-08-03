import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { WeightUnit } from '~/types';

import { supabase } from '../supabaseClient';
import { useProgramMutationErrorHandler } from './useProgramMutationErrorHandler';

export interface SwapProgramMovementArgs {
  userProgramId: string;
  oldMovementName: string;
  newMovementName: string;
  weightOneValue: number | null;
  weightOneUnit: WeightUnit | null;
  weightTwoValue: number | null;
  weightTwoUnit: WeightUnit | null;
}

/**
 * Replaces a movement on every not-yet-completed session of an active
 * enrollment via the `swap_program_movement` RPC, re-basing the replacement's
 * working weight the same way `enroll_in_program` does. Completed sessions
 * and their logged workouts are untouched.
 *
 * Returns the number of sessions rewritten.
 */
export const useSwapProgramMovement = () => {
  const queryClient = useQueryClient();
  const onError = useProgramMutationErrorHandler();

  return useMutation({
    mutationFn: async ({
      userProgramId,
      oldMovementName,
      newMovementName,
      weightOneValue,
      weightOneUnit,
      weightTwoValue,
      weightTwoUnit,
    }: SwapProgramMovementArgs): Promise<number> => {
      const { data, error } = await supabase.rpc('swap_program_movement', {
        p_user_program_id: userProgramId,
        p_old_movement_name: oldMovementName,
        p_new_movement_name: newMovementName,
        p_weight_one_value: weightOneValue ?? undefined,
        p_weight_one_unit: weightOneUnit ?? undefined,
        p_weight_two_value: weightTwoValue ?? undefined,
        p_weight_two_unit: weightTwoUnit ?? undefined,
      });

      if (error) throw error;
      return data as number;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERIES.PROGRAM_PROGRESS] });
      queryClient.invalidateQueries({ queryKey: [QUERIES.ACTIVE_PROGRAM] });
    },
    onError,
  });
};
