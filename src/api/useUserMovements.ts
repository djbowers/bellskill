import { useQuery } from 'react-query';

import { QUERIES } from '~/constants';
import { useSession } from '~/contexts';

import { supabase } from '../supabaseClient';

export interface UserMovement {
  id: string;
  canonicalName: string;
  functionalMovementId: string | null;
  createdAt: string | null;
}

export const useUserMovements = () => {
  const session = useSession();
  const userId = session?.user?.id;

  return useQuery(
    [QUERIES.USER_MOVEMENTS, userId],
    () => fetchUserMovements(userId!),
    { enabled: !!userId },
  );
};

const fetchUserMovements = async (userId: string): Promise<UserMovement[]> => {
  const { data, error } = await supabase
    .from('user_movements')
    .select('id, canonical_name, functional_movement_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data ?? []).map((m) => ({
    id: m.id,
    canonicalName: m.canonical_name,
    functionalMovementId: m.functional_movement_id,
    createdAt: m.created_at,
  }));
};
