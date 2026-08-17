import { useQuery } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { useSession } from '~/contexts';
import {
  ModalityBalance,
  MovementAggregate,
  PatternRpe,
  computeModalityBalance,
} from '~/utils';

import { supabase } from '../supabaseClient';

export interface UseModalityDebtOptions {
  /** Recent window the debt is computed over. Defaults to the SQL default (14). */
  windowDays?: number;
  /** Trailing window used to establish the volume baseline. Defaults to 84. */
  baselineDays?: number;
  /** Skip fetching entirely (e.g. axis disabled by feature flag). */
  enabled?: boolean;
}

/** One row as returned by the `pattern_debt_movements` RPC. */
interface PatternDebtMovementRow {
  movement_id: string | null;
  movement_name: string;
  pattern_credits: string[] | null;
  modality_credits: string[] | null;
  last_trained_at: string | null;
  set_count: number | string;
  total_reps: number | string;
  total_volume_kg: number | string;
  baseline_volume_kg: number | string | null;
  hardest_rpe: PatternRpe | null;
}

/**
 * Modality balance (grind / ballistic / conditioning / mobility). Calls the
 * shared `pattern_debt_movements` RPC for the raw per-movement aggregates,
 * then applies the modality scoring model.
 */
export const useModalityDebt = ({
  windowDays,
  baselineDays,
  enabled = true,
}: UseModalityDebtOptions = {}) => {
  const session = useSession();
  const userId = session?.user?.id;

  return useQuery<ModalityBalance>({
    queryKey: [QUERIES.MODALITY_DEBT, userId, windowDays, baselineDays],
    queryFn: () => fetchModalityDebt(windowDays, baselineDays),
    enabled: !!userId && enabled,
  });
};

const fetchModalityDebt = async (
  windowDays?: number,
  baselineDays?: number,
): Promise<ModalityBalance> => {
  // Generated types (types/supabase.ts) don't yet know about this function —
  // the local db hasn't been migrated. Cast at the RPC boundary only.
  const { data, error } = await supabase.rpc(
    'pattern_debt_movements' as never,
    {
      ...(windowDays != null ? { p_window_days: windowDays } : {}),
      ...(baselineDays != null ? { p_baseline_days: baselineDays } : {}),
    } as never,
  );

  if (error) {
    console.error(error);
    throw error;
  }

  const aggregates: MovementAggregate[] = (
    (data ?? []) as PatternDebtMovementRow[]
  ).map((row) => ({
    movement_id: row.movement_id,
    movement_name: row.movement_name,
    pattern_credits: row.pattern_credits,
    modality_credits: row.modality_credits,
    last_trained_at: row.last_trained_at,
    set_count: Number(row.set_count),
    total_reps: Number(row.total_reps),
    total_volume_kg: Number(row.total_volume_kg),
    baseline_volume_kg:
      row.baseline_volume_kg == null ? null : Number(row.baseline_volume_kg),
    hardest_rpe: row.hardest_rpe ?? null,
  }));

  return computeModalityBalance(aggregates);
};
