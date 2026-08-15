import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';

import { supabase } from '../supabaseClient';

/**
 * Drops a custom `user_movements` row. Only safe when nothing references it —
 * the `movement_logs.user_movement_id` FK has no cascade, so a movement with
 * logs is rejected by the database even if the UI guard is bypassed.
 */
export const useDeleteUserMovement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userMovementId: string): Promise<void> => {
      const { error } = await supabase
        .from('user_movements')
        .delete()
        .eq('id', userMovementId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERIES.USER_MOVEMENTS] });
      queryClient.invalidateQueries({ queryKey: [QUERIES.PATTERN_DEBT] });
    },
  });
};
