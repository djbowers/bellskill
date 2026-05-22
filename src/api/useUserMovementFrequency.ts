import { useQuery } from 'react-query';

import { QUERIES } from '~/constants';
import { useSession } from '~/contexts';

import { supabase } from '../supabaseClient';

export interface UserMovementWithFrequency {
  id: string;
  canonicalName: string;
  functionalMovementId: string | null;
  logCount: number;
}

export const useUserMovementFrequency = () => {
  const session = useSession();
  const userId = session?.user?.id;

  return useQuery(
    [QUERIES.USER_MOVEMENTS, 'frequency', userId],
    () => fetchUserMovementFrequency(userId!),
    { enabled: !!userId },
  );
};

const fetchUserMovementFrequency = async (
  userId: string,
): Promise<UserMovementWithFrequency[]> => {
  const { data, error } = await supabase
    .from('user_movements')
    .select('id, canonical_name, functional_movement_id, movement_logs(count)')
    .eq('user_id', userId);

  if (error) throw error;

  return (data ?? [])
    .map((m) => ({
      id: m.id,
      canonicalName: m.canonical_name,
      functionalMovementId: m.functional_movement_id,
      logCount: Number((m.movement_logs as { count: number }[] | undefined)?.[0]?.count ?? 0),
    }))
    .sort((a, b) => b.logCount - a.logCount);
};
