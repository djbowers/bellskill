import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';

import { supabase } from '../supabaseClient';
import { useProgramMutationErrorHandler } from './useProgramMutationErrorHandler';

export interface SetProgramStageArgs {
  /** The active enrollment to move along its program's stage ladder. */
  userProgramId: string;
  /** Absolute 0-based index into `Program.stages` — serves advance and go-back. */
  stageIndex: number;
}

/**
 * Moves an active enrollment to a stage on its program's progression ladder
 * via the `set_program_stage` RPC. Every not-yet-completed session is
 * rewritten to the stage's title, movements, and notes; each session keeps its
 * own shared weights (deloads stay light), and completed sessions are never
 * touched.
 *
 * Returns the number of sessions rewritten.
 */
export const useSetProgramStage = () => {
  const queryClient = useQueryClient();
  const onError = useProgramMutationErrorHandler();

  return useMutation({
    mutationFn: async ({
      userProgramId,
      stageIndex,
    }: SetProgramStageArgs): Promise<number> => {
      const { data, error } = await supabase.rpc('set_program_stage', {
        p_user_program_id: userProgramId,
        p_stage_index: stageIndex,
      });

      if (error) throw error;
      return data as number;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERIES.PROGRAM_PROGRESS] });
      queryClient.invalidateQueries({ queryKey: [QUERIES.ACTIVE_PROGRAM] });
      queryClient.invalidateQueries({ queryKey: [QUERIES.PROGRAMS] });
    },
    onError,
  });
};
