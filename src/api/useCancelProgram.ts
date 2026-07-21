import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';

import { supabase } from '../supabaseClient';
import { useProgramMutationErrorHandler } from './useProgramMutationErrorHandler';

export interface CancelProgramInput {
  /** The active enrollment (`user_programs.id`) to stop. */
  userProgramId: string;
}

/**
 * Cancels an active enrollment by flipping its status to `abandoned` (the
 * existing terminal status — no new value was added). The enrollment then stops
 * surfacing on Home and in `useActiveProgram` (which only reads active/completed),
 * and the partial `one_active_program_per_user` unique index is freed for a fresh
 * enroll. Progress rows are kept, so re-enrolling starts a new enrollment rather
 * than resuming this one. RLS keeps the update to the user's own enrollment.
 */
export const useCancelProgram = () => {
  const queryClient = useQueryClient();
  const onError = useProgramMutationErrorHandler();

  return useMutation({
    mutationFn: async (input: CancelProgramInput): Promise<void> => {
      const { error } = await supabase
        .from('user_programs')
        .update({ status: 'abandoned' })
        .eq('id', input.userProgramId)
        .eq('status', 'active');
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
