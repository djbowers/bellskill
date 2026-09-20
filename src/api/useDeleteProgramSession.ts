import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';

import { supabase } from '../supabaseClient';
import { useProgramMutationErrorHandler } from './useProgramMutationErrorHandler';

export interface DeleteProgramSessionInput {
  sessionId: string;
  /** The owning program — used to invalidate its cached fetch on success. */
  programId: string;
}

/**
 * Deletes a session from an owned program via the `delete_program_session` RPC.
 *
 * The RPC deletes the row then compacts the survivors: `sequence_index` closes
 * to a contiguous 0..N-1, days renumber within the affected week, and an
 * emptied week drops out so later weeks move up. No gap is left, which the
 * builder's ADD path relies on (it appends at `sessions.length`). RLS keeps the
 * delete owner-only.
 */
export const useDeleteProgramSession = () => {
  const queryClient = useQueryClient();
  const onError = useProgramMutationErrorHandler();

  return useMutation({
    mutationFn: async (input: DeleteProgramSessionInput): Promise<void> => {
      const { error } = await supabase.rpc('delete_program_session', {
        p_session_id: input.sessionId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERIES.PROGRAM, variables.programId] });
      queryClient.invalidateQueries({ queryKey: [QUERIES.PROGRAMS] });
      queryClient.invalidateQueries({ queryKey: [QUERIES.ACTIVE_PROGRAM] });
      queryClient.invalidateQueries({ queryKey: [QUERIES.PROGRAM_PROGRESS] });
    },
    onError,
  });
};
