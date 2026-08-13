import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { WeightTabValue } from '~/types';
import {
  escapeIlikePattern,
  getWeightModeFromCatalogFields,
  tokenizeMovementSearchQuery,
} from '~/utils';

import { supabase } from '../supabaseClient';

export interface MovementSearchResult {
  id: string;
  name: string;
  /** How the movement is held, so picking it can settle the weight mode. */
  weightMode: WeightTabValue | null;
}

const CATALOG_SEARCH_LIMIT = 100;

export const useMovementSearch = (query: string) =>
  useQuery({
    queryKey: [QUERIES.MOVEMENTS, 'search', query],
    queryFn: () => searchMovements(query),
    enabled: query.length >= 2,
    placeholderData: keepPreviousData,
  });

const searchMovements = async (query: string): Promise<MovementSearchResult[]> => {
  const tokens = tokenizeMovementSearchQuery(query);
  if (tokens.length === 0) return [];

  let movementsQuery = supabase
    .from('movements_catalog')
    .select(
      'id, name, primary_equipment, primary_item_count, single_or_double_arm',
    );

  for (const token of tokens) {
    movementsQuery = movementsQuery.ilike('name', `%${escapeIlikePattern(token)}%`);
  }

  const { data, error } = await movementsQuery.limit(CATALOG_SEARCH_LIMIT);

  if (error) throw error;
  return (data ?? [])
    .filter((movement) => movement.id !== null && movement.name !== null)
    .map((movement) => ({
      id: movement.id!,
      name: movement.name!,
      weightMode: getWeightModeFromCatalogFields({
        primaryEquipment: movement.primary_equipment,
        primaryItemCount: movement.primary_item_count,
        singleOrDoubleArm: movement.single_or_double_arm,
      }),
    }));
};
