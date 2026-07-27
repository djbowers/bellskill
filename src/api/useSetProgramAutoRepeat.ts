import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';

import { supabase } from '../supabaseClient';
import { ProgramProgressResult } from './useProgramProgress';
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
  const handleError = useProgramMutationErrorHandler();

  return useMutation({
    mutationFn: async (input: SetProgramAutoRepeatInput): Promise<void> => {
      const { error } = await supabase
        .from('user_programs')
        .update({ auto_repeat: input.autoRepeat })
        .eq('id', input.userProgramId);
      if (error) throw error;
    },
    // Flip the cached progress entry immediately so the Switch doesn't wait on
    // a refetch; roll back from the snapshot if the update fails.
    onMutate: async ({ userProgramId, autoRepeat }) => {
      await queryClient.cancelQueries({
        queryKey: [QUERIES.PROGRAM_PROGRESS],
      });
      const snapshot = queryClient.getQueriesData<ProgramProgressResult>({
        queryKey: [QUERIES.PROGRAM_PROGRESS],
      });
      queryClient.setQueriesData<ProgramProgressResult>(
        { queryKey: [QUERIES.PROGRAM_PROGRESS] },
        (data) =>
          data?.enrollment?.id === userProgramId
            ? { ...data, enrollment: { ...data.enrollment, autoRepeat } }
            : data,
      );
      return { snapshot };
    },
    onError: (error, _input, context) => {
      context?.snapshot.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      handleError(error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [QUERIES.ACTIVE_PROGRAM] });
      queryClient.invalidateQueries({ queryKey: [QUERIES.PROGRAM_PROGRESS] });
      queryClient.invalidateQueries({ queryKey: [QUERIES.PROGRAMS] });
    },
  });
};
