import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';

import { supabase } from '../supabaseClient';
import { useProgramMutationErrorHandler } from './useProgramMutationErrorHandler';

export interface DeleteProgramWeekInput {
  programId: string;
  weekNumber: number;
}

/**
 * Deletes every session in one week of an owned program via the
 * `delete_program_week` RPC, which compacts the survivors so later weeks
 * renumber down. Resolves to the number of sessions deleted.
 */
export const useDeleteProgramWeek = () => {
  const queryClient = useQueryClient();
  const onError = useProgramMutationErrorHandler();

  return useMutation({
    mutationFn: async (input: DeleteProgramWeekInput): Promise<number> => {
      const { data, error } = await supabase.rpc('delete_program_week', {
        p_program_id: input.programId,
        p_week_number: input.weekNumber,
      });
      if (error) throw error;
      return data;
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
