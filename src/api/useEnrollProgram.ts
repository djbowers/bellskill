import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { WeightUnit } from '~/types';

import type { Json } from '../../types/supabase';

import { supabase } from '../supabaseClient';
import { useProgramMutationErrorHandler } from './useProgramMutationErrorHandler';

/**
 * The enrollee's chosen starting weight for one movement, keyed by
 * `movementName`, in that movement's own config shape (a single-bell movement
 * carries `weightTwoValue` null, a bodyweight one is omitted entirely). The
 * value is the movement's working weight; `enroll_in_program` shifts each
 * session by that movement's authored offset from its modal, so a program's
 * heavier test days and lighter deloads still scale along with it.
 */
export interface MovementWeight {
  movementName: string;
  weightOneValue: number | null;
  weightOneUnit: WeightUnit | null;
  weightTwoValue: number | null;
  weightTwoUnit: WeightUnit | null;
}

export interface EnrollProgramArgs {
  programId: string;
  // Optional starting shared weight, mirroring workout_options'
  // sharedWeightOne/Two value+unit shape. When weight one is set, the clone's
  // sharedWeight* fields (which resolveSharedWeights.ts prioritizes over each
  // movement's own weight) are overridden on every placeholder-weight session
  // (see enroll_in_program). A null weight two means two-hand loading; 0 means
  // a single/offset slot. Omit all four to clone verbatim (prior behavior).
  sharedWeightOneValue?: number | null;
  sharedWeightOneUnit?: WeightUnit | null;
  sharedWeightTwoValue?: number | null;
  sharedWeightTwoUnit?: WeightUnit | null;
  /**
   * The active enrollment to drop so this one can take its slot. Required only
   * when all `MAX_ACTIVE_PROGRAMS` slots are taken — otherwise the RPC claims
   * the lowest free slot and raises `PROGRAM_SLOTS_FULL`.
   */
  replaceUserProgramId?: string | null;
  /**
   * Per-movement starting weights, one entry per distinct non-bodyweight
   * movement. Omit for complexSet programs (which use the shared weight above)
   * or to clone verbatim.
   */
  movementWeights?: MovementWeight[];
  /**
   * Whether the new enrollment should loop back to its first session on
   * completion instead of finishing. Omit to inherit the program's
   * `defaultAutoRepeat`; pass a boolean to override the pre-enroll toggle choice.
   */
  autoRepeat?: boolean;
}

/**
 * Enrolls the user in a program via the Slice-1 `enroll_in_program` RPC
 * (copy-on-enroll). Enrolling in a shared program (e.g. DFW) clones it into a
 * user-owned editable copy; enrolling in your own program activates it directly.
 * The new enrollment claims the lowest free parallel slot, so it runs alongside
 * any programs already going. At the cap the RPC raises `PROGRAM_SLOTS_FULL`
 * unless `replaceUserProgramId` names one to drop.
 *
 * Returns the new `user_programs.id`.
 */
export const useEnrollProgram = () => {
  const queryClient = useQueryClient();
  const onError = useProgramMutationErrorHandler();

  return useMutation({
    mutationFn: async ({
      programId,
      sharedWeightOneValue,
      sharedWeightOneUnit,
      sharedWeightTwoValue,
      sharedWeightTwoUnit,
      replaceUserProgramId,
      movementWeights,
      autoRepeat,
    }: EnrollProgramArgs): Promise<string> => {
      const { data, error } = await supabase.rpc('enroll_in_program', {
        p_program_id: programId,
        p_shared_weight_one_value: sharedWeightOneValue ?? undefined,
        p_shared_weight_one_unit: sharedWeightOneUnit ?? undefined,
        p_shared_weight_two_value: sharedWeightTwoValue ?? undefined,
        p_shared_weight_two_unit: sharedWeightTwoUnit ?? undefined,
        p_replace_user_program_id: replaceUserProgramId ?? undefined,
        // Cast: the generated RPC arg is `Json`, which a typed interface can't
        // satisfy structurally (no index signature). The shape is asserted by
        // MovementWeight and by the enroll e2e cases.
        p_movement_weights: movementWeights?.length
          ? (movementWeights as unknown as Json)
          : undefined,
        p_auto_repeat: autoRepeat ?? undefined,
      });

      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERIES.ACTIVE_PROGRAM] });
      queryClient.invalidateQueries({ queryKey: [QUERIES.PROGRAMS] });
    },
    onError,
  });
};
