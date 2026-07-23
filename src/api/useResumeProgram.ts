import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';

import { supabase } from '../supabaseClient';
import { useProgramMutationErrorHandler } from './useProgramMutationErrorHandler';

export interface ResumeProgramArgs {
  /**
   * The exact enrollment (`user_programs.id`) to reactivate — the one whose
   * progress the resume prompt is showing, so the count and the row that comes
   * back can't disagree when a program has several non-active enrollments.
   */
  userProgramId: string;
  /**
   * The active enrollment to drop so the resumed one can take its slot.
   * Required only when all `MAX_ACTIVE_PROGRAMS` slots are taken.
   */
  replaceUserProgramId?: string | null;
}

/**
 * Reactivates a specific non-active enrollment via the `resume_program` RPC,
 * bringing its `program_session_completions` back with it so progress picks up
 * where it left off. It claims the lowest free parallel slot and runs alongside
 * whatever else is active; at the cap the RPC raises `PROGRAM_SLOTS_FULL` unless
 * `replaceUserProgramId` names one to drop. Contrast {@link useEnrollProgram},
 * which starts a fresh enrollment.
 *
 * Returns the reactivated `user_programs.id`.
 */
export const useResumeProgram = () => {
  const queryClient = useQueryClient();
  const onError = useProgramMutationErrorHandler();

  return useMutation({
    mutationFn: async ({
      userProgramId,
      replaceUserProgramId,
    }: ResumeProgramArgs): Promise<string> => {
      const { data, error } = await supabase.rpc('resume_program', {
        p_user_program_id: userProgramId,
        p_replace_user_program_id: replaceUserProgramId ?? undefined,
      });

      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERIES.ACTIVE_PROGRAM] });
      queryClient.invalidateQueries({ queryKey: [QUERIES.PROGRAM_PROGRESS] });
      queryClient.invalidateQueries({ queryKey: [QUERIES.PROGRAMS] });
    },
    onError,
  });
};
