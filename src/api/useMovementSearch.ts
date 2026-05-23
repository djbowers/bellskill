import { useQuery } from 'react-query';

import { QUERIES } from '~/constants';
import { WeightTabValue } from '~/types';
import {
  applyWeightModeToMovementsQuery,
  escapeIlikePattern,
  movementMatchesWeightMode,
  tokenizeMovementSearchQuery,
} from '~/utils';

import { supabase } from '../supabaseClient';

export interface MovementSearchResult {
  id: string;
  name: string;
}

export const useMovementSearch = (query: string, weightMode: WeightTabValue) =>
  useQuery(
    [QUERIES.MOVEMENTS, 'search', query, weightMode],
    () => searchMovements(query, weightMode),
    { enabled: query.length >= 2, keepPreviousData: true },
  );

const searchMovements = async (
  query: string,
  weightMode: WeightTabValue,
): Promise<MovementSearchResult[]> => {
  const tokens = tokenizeMovementSearchQuery(query);
  if (tokens.length === 0) return [];

  let movementsQuery = supabase.from('movements').select('*');

  for (const token of tokens) {
    movementsQuery = movementsQuery.ilike('Movement', `%${escapeIlikePattern(token)}%`);
  }

  movementsQuery = applyWeightModeToMovementsQuery(movementsQuery, weightMode);

  const { data, error } = await movementsQuery.order('Movement').limit(100);

  if (error) throw error;
  return (data ?? [])
    .filter((movement) =>
      movementMatchesWeightMode(
        {
          primaryEquipment: movement['Primary Equipment'],
          primaryItemCount: movement['# Primary Items'],
          singleOrDoubleArm: movement['Single or Double Arm'],
        },
        weightMode,
      ),
    )
    .slice(0, 20)
    .map((m) => ({ id: m.id, name: m['Movement'] }));
};
