import { useQuery } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { Movement } from '~/types';

import { supabase } from '../supabaseClient';
import { mapMovementRow } from './useMovements';

/** Fetch a single catalog movement by id. Resolves `null` when not found. */
export const useMovement = (id: string) =>
  useQuery({
    queryKey: [QUERIES.MOVEMENT, id],
    queryFn: () => fetchMovement(id),
    enabled: id !== '',
  });

const fetchMovement = async (id: string): Promise<Movement | null> => {
  const { data: movement, error } = await supabase
    .from('movements')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw error;
  }

  return movement ? mapMovementRow(movement) : null;
};
