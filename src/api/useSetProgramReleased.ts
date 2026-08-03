import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';

import { supabase } from '../supabaseClient';
import { useProgramMutationErrorHandler } from './useProgramMutationErrorHandler';

export interface SetProgramReleasedInput {
  /** The shared catalog program to release or pull back. */
  programId: string;
  /** `true` releases (visible to everyone); `false` pulls it back. */
  released: boolean;
}

/**
 * Releases or unreleases a shared catalog program by toggling
 * `programs.released_at` through the `set_program_released` RPC. Catalog
 * programs are system-owned (owner_id NULL), so the owner UPDATE policy can't
 * reach them — the RPC is gated server-side to the app owner account.
 */
export const useSetProgramReleased = () => {
  const queryClient = useQueryClient();
  const onError = useProgramMutationErrorHandler();

  return useMutation({
    mutationFn: async (input: SetProgramReleasedInput): Promise<void> => {
      const { error } = await supabase.rpc('set_program_released', {
        p_program_id: input.programId,
        p_released: input.released,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERIES.PROGRAMS] });
    },
    onError,
  });
};
