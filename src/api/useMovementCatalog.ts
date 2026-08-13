import { useQuery } from '@tanstack/react-query';

import { QUERIES } from '~/constants';

import { supabase } from '../supabaseClient';

export interface CatalogMovement {
  id: string;
  name: string;
}

// The slim catalog is a few hundred rows (PROD-153), so fetching it whole is
// cheaper than a round trip per custom movement when scoring suggested matches.
export const useMovementCatalog = () =>
  useQuery({
    queryKey: [QUERIES.MOVEMENTS, 'catalog'],
    queryFn: fetchMovementCatalog,
    staleTime: Infinity,
  });

const fetchMovementCatalog = async (): Promise<CatalogMovement[]> => {
  const { data, error } = await supabase
    .from('movements_catalog')
    .select('id, name');

  if (error) throw error;

  return (data ?? [])
    .filter(
      (movement): movement is CatalogMovement =>
        movement.id !== null && movement.name !== null,
    )
    .map((movement) => ({ id: movement.id, name: movement.name }));
};
