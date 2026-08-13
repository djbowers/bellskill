import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';

import { supabase } from '../supabaseClient';
import { useProgramMutationErrorHandler } from './useProgramMutationErrorHandler';

export interface RenameProgramInput {
  /** The owned program to rename. */
  programId: string;
  title: string;
}

/**
 * Renames an owned program. Shared/system programs have a null `owner_id`, so
 * the existing "Users can update own programs" policy already limits this to
 * the user's own copy — no extra ownership check is needed here.
 */
export const useRenameProgram = () => {
  const queryClient = useQueryClient();
  const onError = useProgramMutationErrorHandler();

  return useMutation({
    mutationFn: async (input: RenameProgramInput): Promise<void> => {
      const { error } = await supabase
        .from('programs')
        .update({ title: input.title.trim() })
        .eq('id', input.programId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QUERIES.PROGRAM, variables.programId],
      });
      queryClient.invalidateQueries({ queryKey: [QUERIES.PROGRAMS] });
      queryClient.invalidateQueries({ queryKey: [QUERIES.ACTIVE_PROGRAM] });
      queryClient.invalidateQueries({ queryKey: [QUERIES.PROGRAM_PROGRESS] });
    },
    onError,
  });
};
