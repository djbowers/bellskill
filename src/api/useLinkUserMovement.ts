import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';

import { supabase } from '../supabaseClient';

export interface LinkUserMovementInput {
  userMovementId: string;
  functionalMovementId: string;
}

/**
 * Points a custom `user_movements` row at its catalog equivalent. The row keeps
 * its id, so existing `movement_logs` stay attached and retroactively gain
 * catalog metadata (weight modes, pattern debt, recommender inputs).
 */
export const useLinkUserMovement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LinkUserMovementInput): Promise<void> => {
      const { error } = await supabase
        .from('user_movements')
        .update({ functional_movement_id: input.functionalMovementId })
        .eq('id', input.userMovementId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERIES.USER_MOVEMENTS] });
      queryClient.invalidateQueries({ queryKey: [QUERIES.PATTERN_DEBT] });
    },
  });
};
