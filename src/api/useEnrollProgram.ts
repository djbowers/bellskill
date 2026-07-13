import { useMutation, useQueryClient } from 'react-query';

import { QUERIES } from '~/constants';

import { supabase } from '../supabaseClient';
import { useProgramMutationErrorHandler } from './useProgramMutationErrorHandler';

export interface EnrollProgramArgs {
  programId: string;
  // Kilograms. When set, overrides the placeholder load on every cloned
  // session that still carries the source program's default weight (see
  // enroll_in_program's p_starting_weight_kg). Omit/null leaves the clone's
  // weights byte-identical to the source, matching prior behavior.
  startingWeightKg?: number | null;
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
      startingWeightKg,
    }: EnrollProgramArgs): Promise<string> => {
      const { data, error } = await supabase.rpc('enroll_in_program', {
        p_program_id: programId,
        p_starting_weight_kg: startingWeightKg ?? undefined,
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
