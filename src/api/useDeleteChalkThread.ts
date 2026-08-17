import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';

import { supabase } from '../supabaseClient';

/**
 * Deletes a conversation. This is the one client write the schema grants —
 * RLS scopes it to the caller's own threads, and the messages cascade.
 */
export const useDeleteChalkThread = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (threadId: string) => {
      const { error } = await supabase
        .from('chalk_threads')
        .delete()
        .eq('id', threadId);

      if (error) {
        console.error(error);
        throw error;
      }

      return threadId;
    },
    onSuccess: (threadId) => {
      queryClient.invalidateQueries({ queryKey: [QUERIES.CHALK_THREADS] });
      queryClient.removeQueries({
        queryKey: [QUERIES.CHALK_MESSAGES, threadId],
      });
    },
  });
};
