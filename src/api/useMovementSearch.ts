import { useQuery } from 'react-query';

import { QUERIES } from '~/constants';

import { supabase } from '../supabaseClient';

export interface MovementSearchResult {
  id: string;
  name: string;
}

export const useMovementSearch = (query: string) =>
  useQuery(
    [QUERIES.MOVEMENTS, 'search', query],
    () => searchMovements(query),
    { enabled: query.length >= 2, keepPreviousData: true },
  );

const searchMovements = async (query: string): Promise<MovementSearchResult[]> => {
  const { data, error } = await supabase
    .from('movements')
    .select('id, Movement')
    .ilike('Movement', `%${query}%`)
    .order('Movement')
    .limit(8);

  if (error) throw error;
  return (data ?? []).map((m) => ({ id: m.id, name: m['Movement'] }));
};
