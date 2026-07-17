import { useMutation, useQueryClient } from 'react-query';

import { QUERIES } from '~/constants';

import { supabase } from '../supabaseClient';
import { useProgramMutationErrorHandler } from './useProgramMutationErrorHandler';

export interface DeleteProgramInput {
  /** The owned program to permanently remove. */
  programId: string;
}

/**
 * Permanently deletes an owned program. This is the irreversible counterpart to
 * archiving: the `ON DELETE CASCADE` foreign keys take its sessions, any
 * enrollments, and their completions with it, so callers MUST gate it behind an
 * explicit confirm. RLS ("Users can delete own programs") restricts it to the
 * owner — shared/system programs can never be deleted this way.
 */
export const useDeleteProgram = () => {
  const queryClient = useQueryClient();
  const onError = useProgramMutationErrorHandler();

  return useMutation({
    mutationFn: async (input: DeleteProgramInput): Promise<void> => {
      const { error } = await supabase
        .from('programs')
        .delete()
        .eq('id', input.programId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries([QUERIES.PROGRAMS]);
      queryClient.invalidateQueries([QUERIES.ACTIVE_PROGRAM]);
      queryClient.invalidateQueries([QUERIES.PROGRAM_PROGRESS]);
    },
    onError,
  });
};
