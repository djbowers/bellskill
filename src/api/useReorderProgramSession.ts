import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';

import { supabase } from '../supabaseClient';
import { useProgramMutationErrorHandler } from './useProgramMutationErrorHandler';

export interface ReorderProgramSessionsInput {
  programId: string;
  /**
   * The program's session ids in the desired order — a permutation of exactly
   * the program's current session ids. The RPC reassigns `sequence_index`
   * 0..N-1 in this order and relabels week/day from the program's
   * `days_per_week`.
   */
  orderedIds: string[];
}

/**
 * Reorders an owned program's sessions via the `reorder_program_sessions` RPC.
 *
 * Persisting a reorder by permuting `sequence_index` cannot be a naive
 * multi-row UPDATE: `UNIQUE (program_id, sequence_index)` is NOT deferrable, so
 * a swap transiently duplicates an index and violates the constraint. The RPC
 * does the reindex atomically with a temp offset (see the migration). RLS keeps
 * it owner-only, so the read-only shared program can never be reordered here.
 */
export const useReorderProgramSessions = () => {
  const queryClient = useQueryClient();
  const onError = useProgramMutationErrorHandler();

  return useMutation({
    mutationFn: async (input: ReorderProgramSessionsInput): Promise<void> => {
      const { error } = await supabase.rpc('reorder_program_sessions', {
        p_program_id: input.programId,
        p_ordered_ids: input.orderedIds,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERIES.PROGRAM, variables.programId] });
      queryClient.invalidateQueries({ queryKey: [QUERIES.ACTIVE_PROGRAM] });
      queryClient.invalidateQueries({ queryKey: [QUERIES.PROGRAM_PROGRESS] });
    },
    onError,
  });
};
