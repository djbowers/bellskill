import { signOutIfStaleAuthUser } from '~/utils';

import { supabase } from '../supabaseClient';

export interface UserMovementRow {
  id: string;
  canonical_name: string;
  functional_movement_id: string | null;
}

const normalizeUserMovementRow = (
  row: UserMovementRow | UserMovementRow[] | null | undefined,
): UserMovementRow | null => {
  if (!row) return null;
  return Array.isArray(row) ? (row[0] ?? null) : row;
};

const findUserMovement = async (
  userId: string,
  column: 'functional_movement_id' | 'canonical_name',
  value: string,
): Promise<UserMovementRow | null> => {
  const { data } = await supabase
    .from('user_movements')
    .select('id, canonical_name, functional_movement_id')
    .eq('user_id', userId)
    .eq(column, value)
    .limit(1)
    .maybeSingle();

  return normalizeUserMovementRow(
    data as UserMovementRow | UserMovementRow[] | null,
  );
};

const updateUserMovement = async (
  existing: UserMovementRow,
  patch: Partial<
    Pick<UserMovementRow, 'canonical_name' | 'functional_movement_id'>
  >,
): Promise<UserMovementRow | null> => {
  const { data: updated, error } = await supabase
    .from('user_movements')
    .update(patch)
    .eq('id', existing.id)
    .select()
    .single();

  if (error) {
    if (await signOutIfStaleAuthUser(error)) {
      return null;
    }
    throw error;
  }

  return normalizeUserMovementRow(
    (updated ?? existing) as UserMovementRow | UserMovementRow[],
  );
};

// A lifter gets one row per catalog movement, and that row carries the catalog
// name — logs link to it by name, so the two must agree.
export const createOrReuseUserMovement = async ({
  userId,
  canonicalName,
  functionalMovementId,
}: {
  userId: string;
  canonicalName: string;
  functionalMovementId?: string | null;
}): Promise<UserMovementRow | null> => {
  if (functionalMovementId) {
    const linked = await findUserMovement(
      userId,
      'functional_movement_id',
      functionalMovementId,
    );

    if (linked?.id) {
      if (linked.canonical_name === canonicalName) return linked;
      return updateUserMovement(linked, { canonical_name: canonicalName });
    }
  }

  const existing = await findUserMovement(
    userId,
    'canonical_name',
    canonicalName,
  );

  if (existing?.id) {
    if (functionalMovementId && !existing.functional_movement_id) {
      return updateUserMovement(existing, {
        functional_movement_id: functionalMovementId,
      });
    }

    return existing;
  }

  const { data: insertedRaw, error } = await supabase
    .from('user_movements')
    .insert({
      user_id: userId,
      canonical_name: canonicalName,
      functional_movement_id: functionalMovementId ?? null,
    })
    .select()
    .single();

  if (error) {
    if (await signOutIfStaleAuthUser(error)) {
      return null;
    }
    throw error;
  }
  return normalizeUserMovementRow(
    insertedRaw as UserMovementRow | UserMovementRow[] | null,
  );
};
