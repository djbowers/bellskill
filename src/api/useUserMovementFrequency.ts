import { useQuery } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { useSession } from '~/contexts';
import { MovementWeightModeFields } from '~/utils';

import { supabase } from '../supabaseClient';

export interface UserMovementWithFrequency {
  id: string;
  canonicalName: string;
  functionalMovementId: string | null;
  catalogName: string | null;
  catalogWeightFields: MovementWeightModeFields | null;
  logCount: number;
}

export const useUserMovementFrequency = () => {
  const session = useSession();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: [QUERIES.USER_MOVEMENTS, 'frequency', userId],
    queryFn: () => fetchUserMovementFrequency(userId!),
    enabled: !!userId,
  });
};

const toCatalogWeightFields = (
  movement: Record<string, unknown> | undefined,
): MovementWeightModeFields | null => {
  if (!movement) return null;

  return {
    primaryEquipment: movement['Primary Equipment'] as string | null,
    primaryItemCount: movement['# Primary Items'] as number | null,
    singleOrDoubleArm: movement['Single or Double Arm'] as string | null,
  };
};

const fetchUserMovementFrequency = async (
  userId: string,
): Promise<UserMovementWithFrequency[]> => {
  const { data: userMovements, error } = await supabase
    .from('user_movements')
    .select('id, canonical_name, functional_movement_id, movement_logs(count)')
    .eq('user_id', userId);

  if (error) throw error;

  const catalogIds = [
    ...new Set(
      (userMovements ?? [])
        .map((movement) => movement.functional_movement_id)
        .filter((id): id is string => id != null),
    ),
  ];

  const catalogById = new Map<string, Record<string, unknown>>();

  if (catalogIds.length > 0) {
    const { data: catalogMovements, error: catalogError } = await supabase
      .from('movements')
      .select('*')
      .in('id', catalogIds);

    if (catalogError) throw catalogError;

    for (const movement of catalogMovements ?? []) {
      catalogById.set(movement.id, movement);
    }
  }

  const rows = (userMovements ?? []).map((movement) => {
    const catalogMovement = movement.functional_movement_id
      ? catalogById.get(movement.functional_movement_id)
      : undefined;

    return {
      id: movement.id,
      canonicalName: movement.canonical_name,
      functionalMovementId: movement.functional_movement_id,
      catalogName:
        (catalogMovement?.['Movement'] as string | undefined) ?? null,
      catalogWeightFields: toCatalogWeightFields(catalogMovement),
      logCount: Number(
        (movement.movement_logs as { count: number }[] | undefined)?.[0]
          ?.count ?? 0,
      ),
    };
  });

  return mergeUserMovementsByCatalog(rows).sort(
    (a, b) => b.logCount - a.logCount,
  );
};

// Rows linked to the same catalog movement are one movement to the lifter:
// collapse them, pool their logs, and show the catalog's name.
export const mergeUserMovementsByCatalog = (
  rows: UserMovementWithFrequency[],
): UserMovementWithFrequency[] => {
  const merged: UserMovementWithFrequency[] = [];
  const byCatalogId = new Map<string, UserMovementWithFrequency>();

  for (const row of rows) {
    if (!row.functionalMovementId) {
      merged.push(row);
      continue;
    }

    const displayName = row.catalogName ?? row.canonicalName;
    const existing = byCatalogId.get(row.functionalMovementId);

    if (!existing) {
      const entry = { ...row, canonicalName: displayName };
      byCatalogId.set(row.functionalMovementId, entry);
      merged.push(entry);
      continue;
    }

    const rowIsCatalogNamed = row.canonicalName === row.catalogName;
    if (rowIsCatalogNamed) existing.id = row.id;
    existing.logCount += row.logCount;
  }

  return merged;
};
