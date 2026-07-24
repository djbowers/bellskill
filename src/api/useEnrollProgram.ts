import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { WeightUnit } from '~/types';

import type { Json } from '../../types/supabase';

import { supabase } from '../supabaseClient';
import { useProgramMutationErrorHandler } from './useProgramMutationErrorHandler';

/**
 * An explicit weight for one of the program's weight groups, keyed by the
 * group's **authored** weight pair. Overrides `enroll_in_program`'s default,
 * which shifts each group by its authored offset from the working weight — so
 * the enrollee can name the bell they actually own for a deload or test day.
 */
export interface ProgramWeightOverride {
  sourceWeightOneValue: number | null;
  sourceWeightTwoValue: number | null;
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
  /** Per-group explicit weights; omit to let the RPC derive them by offset. */
  weightOverrides?: ProgramWeightOverride[];
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
      weightOverrides,
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
        // ProgramWeightOverride and by the enroll e2e cases.
        p_weight_overrides: weightOverrides?.length
          ? (weightOverrides as unknown as Json)
          : undefined,
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
