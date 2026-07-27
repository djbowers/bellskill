import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';

import { supabase } from '../supabaseClient';
import { useProgramMutationErrorHandler } from './useProgramMutationErrorHandler';

export interface SetProgramAutoRepeatInput {
  /** The enrollment (`user_programs.id`) to update. */
  userProgramId: string;
  /** `true` to loop the program on completion, `false` to let it finish. */
  autoRepeat: boolean;
}

/**
 * Flips an enrollment's auto-repeat toggle. When on, finishing the program's
 * last session loops back to the first (see complete_program_session) instead of
 * flipping to `completed`. A one-column update on the user's own enrollment; RLS
 * keeps it scoped to them.
 */
export const useSetProgramAutoRepeat = () => {
  const queryClient = useQueryClient();
  const onError = useProgramMutationErrorHandler();

  return useMutation({
    mutationFn: async (input: SetProgramAutoRepeatInput): Promise<void> => {
      const { error } = await supabase
        .from('user_programs')
        .update({ auto_repeat: input.autoRepeat })
        .eq('id', input.userProgramId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERIES.ACTIVE_PROGRAM] });
      queryClient.invalidateQueries({ queryKey: [QUERIES.PROGRAM_PROGRESS] });
      queryClient.invalidateQueries({ queryKey: [QUERIES.PROGRAMS] });
    },
    onError,
  });
};
