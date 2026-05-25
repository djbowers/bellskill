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

export const createOrReuseUserMovement = async ({
  userId,
  canonicalName,
  functionalMovementId,
}: {
  userId: string;
  canonicalName: string;
  functionalMovementId?: string | null;
}): Promise<UserMovementRow | null> => {
  const { data: existingRaw } = await supabase
    .from('user_movements')
    .select('id, canonical_name, functional_movement_id')
    .eq('user_id', userId)
    .eq('canonical_name', canonicalName)
    .limit(1)
    .maybeSingle();

  const existing = normalizeUserMovementRow(
    existingRaw as UserMovementRow | UserMovementRow[] | null,
  );

  if (existing?.id) {
    if (functionalMovementId && !existing.functional_movement_id) {
      const { data: updated, error: updateError } = await supabase
        .from('user_movements')
        .update({ functional_movement_id: functionalMovementId })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        if (await signOutIfStaleAuthUser(updateError)) {
          return null;
        }
        throw updateError;
      }

      return normalizeUserMovementRow(
        (updated ?? existing) as UserMovementRow | UserMovementRow[],
      );
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
