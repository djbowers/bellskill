import { useMutation, useQueryClient } from 'react-query';

import { QUERIES } from '~/constants';

import { supabase } from '../supabaseClient';
import { useProgramMutationErrorHandler } from './useProgramMutationErrorHandler';

export interface SetProgramArchivedInput {
  /** The owned program to archive or restore. */
  programId: string;
  /** `true` archives (hides from the default list); `false` restores. */
  archived: boolean;
}

/**
 * Archives or restores an owned program by setting/clearing `programs.archived_at`.
 * Archiving is the reversible, history-preserving alternative to deletion: the
 * program (and every enrollment/completion referencing it) is kept, just hidden
 * from the default "My programs" list until restored. It's an ordinary owner
 * UPDATE — the existing "Users can update own programs" policy already covers it.
 */
export const useSetProgramArchived = () => {
  const queryClient = useQueryClient();
  const onError = useProgramMutationErrorHandler();

  return useMutation({
    mutationFn: async (input: SetProgramArchivedInput): Promise<void> => {
      const { error } = await supabase
        .from('programs')
        .update({ archived_at: input.archived ? new Date().toISOString() : null })
        .eq('id', input.programId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries([QUERIES.PROGRAMS]);
      queryClient.invalidateQueries([QUERIES.ACTIVE_PROGRAM]);
    },
    onError,
  });
};
