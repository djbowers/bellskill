import { useMutation, useQueryClient } from 'react-query';

import { QUERIES } from '~/constants';
import { useSession } from '~/contexts';
import { signOutIfStaleAuthUser } from '~/utils';

import { supabase } from '../supabaseClient';

interface CreateUserMovementInput {
  canonicalName: string;
  functionalMovementId?: string | null;
}

export const useCreateUserMovement = () => {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session?.user?.id;

  return useMutation({
    mutationFn: ({ canonicalName, functionalMovementId }: CreateUserMovementInput) => {
      if (!userId) return Promise.resolve(null);
      return createOrReuseUserMovement({ userId, canonicalName, functionalMovementId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries([QUERIES.USER_MOVEMENTS]);
    },
  });
};

const createOrReuseUserMovement = async ({
  userId,
  canonicalName,
  functionalMovementId,
}: {
  userId: string;
  canonicalName: string;
  functionalMovementId?: string | null;
}) => {
  const { data: existing } = await supabase
    .from('user_movements')
    .select('id, canonical_name, functional_movement_id')
    .eq('user_id', userId)
    .eq('canonical_name', canonicalName)
    .limit(1)
    .maybeSingle();

  if (existing) {
    if (functionalMovementId && !existing.functional_movement_id) {
      const { data: updated, error: updateError } = await supabase
        .from('user_movements')
        .update({ functional_movement_id: functionalMovementId })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        if (await signOutIfStaleAuthUser(updateError)) {
          return null;
        }
        throw updateError;
      }

      return updated ?? existing;
    }

    return existing;
  }

  const { data, error } = await supabase
    .from('user_movements')
    .insert({
      user_id: userId,
      canonical_name: canonicalName,
      functional_movement_id: functionalMovementId ?? null,
    })
    .select()
    .single();

  if (error) {
    if (await signOutIfStaleAuthUser(error)) {
      return null;
    }
    throw error;
  }
  return data;
};
