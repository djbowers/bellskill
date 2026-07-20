import { UseQueryOptions, useQuery } from 'react-query';

import { QUERIES } from '~/constants';
import { DifficultyLevel, Equipment, Movement, MuscleGroup } from '~/types';

import { supabase } from '../supabaseClient';

interface MovementFilters {
  difficultyLevel?: DifficultyLevel;
  equipment?: Equipment;
  movementName?: string;
  muscleGroup?: MuscleGroup;
}

interface UseMovementsOptions {
  page?: number;
  limit?: number;
  order?: 'ASC' | 'DESC';
  orderBy?: string;
  where?: MovementFilters;
}

interface MovementsResponse {
  movements: Movement[];
  count: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export const useMovements = (
  options: UseMovementsOptions = {},
  queryOptions?: Omit<
    UseQueryOptions<MovementsResponse>,
    'queryKey' | 'queryFn'
  >,
) =>
  useQuery(
    [QUERIES.MOVEMENTS, options],
    () => fetchMovements(options),
    queryOptions,
  );

const fetchMovements = async ({
  page = 1,
  limit = 25,
  order = 'ASC',
  orderBy = 'Movement',
  where,
}: UseMovementsOptions): Promise<MovementsResponse> => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase.from('movements').select('*', { count: 'exact' });
  query = query.order(orderBy, { ascending: order === 'ASC' });

  if (where?.difficultyLevel) {
    query = query.eq('Difficulty Level', where.difficultyLevel);
  }
  if (where?.equipment) {
    query = query.eq('Primary Equipment', where.equipment);
  }
  if (where?.movementName) {
    query = query.ilike('Movement', `%${where.movementName}%`);
  }
  if (where?.muscleGroup) {
    query = query.eq('Target Muscle Group', where.muscleGroup);
  }

  // First get the total count
  const { count, error: countError } = await query;

  if (countError) {
    console.error(countError);
    throw countError;
  }

  const totalCount = count ?? 0;
  const hasNextPage = to < totalCount - 1;
  const hasPreviousPage = page > 1;

  // Then get the paginated data
  const { data: movements, error } = await query.range(from, to);

  if (error) {
    console.error(error);
    throw error;
  }

  return {
    count: totalCount,
    hasNextPage,
    hasPreviousPage,
    movements:
      movements.map(
        (movement): Movement => ({
          id: movement['id'],
          difficultyLevel: movement[
            'Difficulty Level'
          ] as DifficultyLevel | null,
          movementName: movement['Movement'],
          movementPattern1: movement['Movement Pattern #1'],
          primaryEquipment: movement['Primary Equipment'] as Equipment | null,
          primaryItemCount: movement['# Primary Items'],
          singleOrDoubleArm: movement[
            'Single or Double Arm'
          ] as Movement['singleOrDoubleArm'],
          targetMuscleGroup: movement[
            'Target Muscle Group'
          ] as MuscleGroup | null,
        }),
      ) ?? [],
  };
};
