import { useQuery } from 'react-query';

import { QUERIES } from '~/constants';
import { WeightTabValue } from '~/types';
import { applyWeightModeToMovementsQuery } from '~/utils';

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
  let movementsQuery = supabase
    .from('movements')
    .select('id, Movement')
    .ilike('Movement', `%${query}%`);

  movementsQuery = applyWeightModeToMovementsQuery(movementsQuery, weightMode);

  const { data, error } = await movementsQuery.order('Movement').limit(8);

  if (error) throw error;
  return (data ?? []).map((m) => ({ id: m.id, name: m['Movement'] }));
};
