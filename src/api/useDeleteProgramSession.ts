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
 * The RPC deletes the row then compacts the survivors to a contiguous 0..N-1
 * (relabeling week/day), so no gap is left. That matters because the builder's
 * ADD path computes the next `sequence_index` as `sessions.length`; a gap would
 * make the next save collide with a surviving higher index and violate
 * `UNIQUE (program_id, sequence_index)`. RLS keeps the delete owner-only.
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
