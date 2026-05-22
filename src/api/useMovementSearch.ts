import { useQuery } from 'react-query';

import { QUERIES } from '~/constants';

import { supabase } from '../supabaseClient';

export interface MovementSearchResult {
  id: string;
  name: string;
}

export const useMovementSearch = (query: string, singleOrDoubleArm?: string | null) =>
  useQuery(
    [QUERIES.MOVEMENTS, 'search', query, singleOrDoubleArm],
    () => searchMovements(query, singleOrDoubleArm),
    { enabled: query.length >= 2, keepPreviousData: true },
  );

const searchMovements = async (
  query: string,
  singleOrDoubleArm?: string | null,
): Promise<MovementSearchResult[]> => {
  let q = supabase
    .from('movements')
    .select('id, Movement')
    .ilike('Movement', `%${query}%`)
    .in('"Primary Equipment"', ['Kettlebell', 'Bodyweight'])
    .order('Movement')
    .limit(20);

  if (singleOrDoubleArm) {
    q = q.eq('"Single or Double Arm"', singleOrDoubleArm);
  }

  const { data, error } = await q;

  if (error) throw error;
  return (data ?? []).map((m) => ({ id: m.id, name: m['Movement'] }));
};
