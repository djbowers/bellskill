import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';

import { supabase } from '../supabaseClient';
import { useProgramMutationErrorHandler } from './useProgramMutationErrorHandler';

export interface DequeueProgramInput {
  /** The queued enrollment (`user_programs.id`) to remove from the line. */
  userProgramId: string;
}

/**
 * Removes a queued enrollment from the user's queue by abandoning it. The
 * remaining rows keep their positions — gaps are fine, promotion orders by
 * `queue_position`. A plain RLS-scoped update, like `useSetProgramAutoRepeat`.
 */
export const useDequeueProgram = () => {
  const queryClient = useQueryClient();
  const onError = useProgramMutationErrorHandler();

  return useMutation({
    mutationFn: async ({ userProgramId }: DequeueProgramInput) => {
      const { error } = await supabase
        .from('user_programs')
        .update({ status: 'abandoned', queue_position: null })
        .eq('id', userProgramId)
        .eq('status', 'queued');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERIES.QUEUED_PROGRAMS] });
      queryClient.invalidateQueries({ queryKey: [QUERIES.PROGRAMS] });
      queryClient.invalidateQueries({ queryKey: [QUERIES.ACTIVE_PROGRAM] });
    },
    onError,
  });
};

export interface StartQueuedProgramInput {
  /** The queued enrollment (`user_programs.id`) to activate right now. */
  userProgramId: string;
  /** The free parallel slot (1–3) it should claim; the caller picks one. */
  slot: number;
}

/**
 * Activates a queued enrollment immediately instead of waiting for a program
 * to finish — only offered when a slot is free. The partial unique index
 * `one_program_per_active_slot` rejects a stale claim if the slot filled in
 * the meantime.
 */
export const useStartQueuedProgram = () => {
  const queryClient = useQueryClient();
  const onError = useProgramMutationErrorHandler();

  return useMutation({
    mutationFn: async ({ userProgramId, slot }: StartQueuedProgramInput) => {
      const { error } = await supabase
        .from('user_programs')
        .update({
          status: 'active',
          active_slot: slot,
          queue_position: null,
          started_at: new Date().toISOString(),
        })
        .eq('id', userProgramId)
        .eq('status', 'queued');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERIES.QUEUED_PROGRAMS] });
      queryClient.invalidateQueries({ queryKey: [QUERIES.PROGRAMS] });
      queryClient.invalidateQueries({ queryKey: [QUERIES.ACTIVE_PROGRAM] });
      queryClient.invalidateQueries({ queryKey: [QUERIES.PROGRAM_PROGRESS] });
    },
    onError,
  });
};
