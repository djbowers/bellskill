import { useMutation, useQueryClient } from 'react-query';

import { QUERIES } from '~/constants';
import { WeightUnit } from '~/types';

import { supabase } from '../supabaseClient';
import { useProgramMutationErrorHandler } from './useProgramMutationErrorHandler';

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
}

/**
 * Enrolls the user in a program via the Slice-1 `enroll_in_program` RPC
 * (copy-on-enroll). Enrolling in a shared program (e.g. DFW) clones it into a
 * user-owned editable copy; enrolling in your own program activates it directly.
 * Any currently-active enrollment is abandoned atomically inside the function,
 * so the one-active-program constraint is never violated.
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
    }: EnrollProgramArgs): Promise<string> => {
      const { data, error } = await supabase.rpc('enroll_in_program', {
        p_program_id: programId,
        p_shared_weight_one_value: sharedWeightOneValue ?? undefined,
        p_shared_weight_one_unit: sharedWeightOneUnit ?? undefined,
        p_shared_weight_two_value: sharedWeightTwoValue ?? undefined,
        p_shared_weight_two_unit: sharedWeightTwoUnit ?? undefined,
      });

      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries([QUERIES.ACTIVE_PROGRAM]);
      queryClient.invalidateQueries([QUERIES.PROGRAMS]);
    },
    onError,
  });
};
