import { useMutation, useQueryClient } from 'react-query';

import { QUERIES } from '~/constants';

import { supabase } from '../supabaseClient';
import { useProgramMutationErrorHandler } from './useProgramMutationErrorHandler';

export interface ResumeProgramArgs {
  /** The program to resume — the user's own copy, as listed in "My programs". */
  programId: string;
}

/**
 * Reactivates the user's most recent non-active enrollment in a program via the
 * `resume_program` RPC, bringing its `program_session_completions` back with it
 * so progress picks up where it left off. Any other active enrollment is
 * abandoned atomically inside the function, so the one-active-program constraint
 * holds. Contrast {@link useEnrollProgram}, which starts a fresh enrollment.
 *
 * Returns the reactivated `user_programs.id`.
 */
export const useResumeProgram = () => {
  const queryClient = useQueryClient();
  const onError = useProgramMutationErrorHandler();

  return useMutation({
    mutationFn: async ({ programId }: ResumeProgramArgs): Promise<string> => {
      const { data, error } = await supabase.rpc('resume_program', {
        p_program_id: programId,
      });

      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries([QUERIES.ACTIVE_PROGRAM]);
      queryClient.invalidateQueries([QUERIES.PROGRAM_PROGRESS]);
      queryClient.invalidateQueries([QUERIES.PROGRAMS]);
    },
    onError,
  });
};
