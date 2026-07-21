import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { WeightTabValue } from '~/types';
import {
  applyWeightModeToCatalogQuery,
  escapeIlikePattern,
  tokenizeMovementSearchQuery,
} from '~/utils';

import { supabase } from '../supabaseClient';

export interface MovementSearchResult {
  id: string;
  name: string;
}

const CATALOG_SEARCH_LIMIT = 100;

export const useMovementSearch = (query: string, weightMode: WeightTabValue) =>
  useQuery({
    queryKey: [QUERIES.MOVEMENTS, 'search', query, weightMode],
    queryFn: () => searchMovements(query, weightMode),
    enabled: query.length >= 2,
    placeholderData: keepPreviousData,
  });

const searchMovements = async (
  query: string,
  weightMode: WeightTabValue,
): Promise<MovementSearchResult[]> => {
  const tokens = tokenizeMovementSearchQuery(query);
  if (tokens.length === 0) return [];

  let movementsQuery = supabase.from('movements_catalog').select('id, name');

  for (const token of tokens) {
    movementsQuery = movementsQuery.ilike('name', `%${escapeIlikePattern(token)}%`);
  }

  movementsQuery = applyWeightModeToCatalogQuery(movementsQuery, weightMode);

  const { data, error } = await movementsQuery.limit(CATALOG_SEARCH_LIMIT);

  if (error) throw error;
  return (data ?? [])
    .filter(
      (movement): movement is { id: string; name: string } =>
        movement.id !== null && movement.name !== null,
    )
    .map((movement) => ({
      id: movement.id,
      name: movement.name,
    }));
};
