import { useMutation, useQueryClient } from 'react-query';

import { QUERIES } from '~/constants';
import { useSession } from '~/contexts';

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
    .select('id, canonical_name')
    .eq('user_id', userId)
    .eq('canonical_name', canonicalName)
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from('user_movements')
    .insert({
      user_id: userId,
      canonical_name: canonicalName,
      functional_movement_id: functionalMovementId ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};
