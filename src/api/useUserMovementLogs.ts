import { useQuery } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { useSession } from '~/contexts';

import { supabase } from '../supabaseClient';
import {
  MOVEMENT_HISTORY_SELECT,
  MovementHistoryEntry,
  byMostRecent,
  mapMovementHistoryRows,
} from './movementHistory';

/**
 * Every log attached to one `user_movements` row. Unlike `useMovementHistory`,
 * this works for custom movements too — they have no catalog link to filter on.
 */
export const useUserMovementLogs = (userMovementId: string | null) => {
  const session = useSession();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: [
      QUERIES.MOVEMENT_HISTORY,
      userId,
      'userMovement',
      userMovementId,
    ],
    queryFn: () => fetchUserMovementLogs(userMovementId!),
    enabled: !!userMovementId && !!userId,
  });
};

const fetchUserMovementLogs = async (
  userMovementId: string,
): Promise<MovementHistoryEntry[]> => {
  const { data: rows, error } = await supabase
    .from('movement_logs')
    .select(MOVEMENT_HISTORY_SELECT)
    .eq('user_movement_id', userMovementId);

  if (error) {
    console.error(error);
    throw error;
  }

  return mapMovementHistoryRows(rows).sort(byMostRecent);
};
