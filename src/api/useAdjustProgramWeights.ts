import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { WeightUnit } from '~/types';

import type { Json } from '../../types/supabase';

import { supabase } from '../supabaseClient';
import type { MovementWeight } from './useEnrollProgram';
import { useProgramMutationErrorHandler } from './useProgramMutationErrorHandler';

export interface AdjustProgramWeightsArgs {
  /** The active enrollment whose upcoming sessions get the new weights. */
  userProgramId: string;
  /**
   * New shared bell pair for complexSet programs, mirroring workout_options'
   * sharedWeightOne/Two value+unit shape. Provide either these or
   * `movementWeights`, matching the enrollment picker for the program.
   */
  sharedWeightOneValue?: number | null;
  sharedWeightOneUnit?: WeightUnit | null;
  sharedWeightTwoValue?: number | null;
  sharedWeightTwoUnit?: WeightUnit | null;
  /**
   * New working weight per non-bodyweight movement — the same shape
   * `enroll_in_program` takes, re-based onto every session not yet completed.
   */
  movementWeights?: MovementWeight[];
}

/**
 * Rewrites the weights on every not-yet-completed session of an active
 * enrollment via the `adjust_program_weights` RPC — the mid-program
 * counterpart to the enrollment starting-weight picker. Authored per-session
 * offsets (test days heavier, deloads lighter) are preserved; completed
 * sessions and their logged workouts are untouched.
 *
 * Returns the number of sessions rewritten.
 */
export const useAdjustProgramWeights = () => {
  const queryClient = useQueryClient();
  const onError = useProgramMutationErrorHandler();

  return useMutation({
    mutationFn: async ({
      userProgramId,
      sharedWeightOneValue,
      sharedWeightOneUnit,
      sharedWeightTwoValue,
      sharedWeightTwoUnit,
      movementWeights,
    }: AdjustProgramWeightsArgs): Promise<number> => {
      const { data, error } = await supabase.rpc('adjust_program_weights', {
        p_user_program_id: userProgramId,
        p_shared_weight_one_value: sharedWeightOneValue ?? undefined,
        p_shared_weight_one_unit: sharedWeightOneUnit ?? undefined,
        p_shared_weight_two_value: sharedWeightTwoValue ?? undefined,
        p_shared_weight_two_unit: sharedWeightTwoUnit ?? undefined,
        // Cast: the generated RPC arg is `Json`, which a typed interface can't
        // satisfy structurally (no index signature). The shape is asserted by
        // MovementWeight and by the adjust-weights e2e cases.
        p_movement_weights: movementWeights?.length
          ? (movementWeights as unknown as Json)
          : undefined,
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
