import { useQuery } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { useSession } from '~/contexts';
import {
  MovementAggregate,
  PatternBalance,
  PatternRpe,
  computePatternBalance,
} from '~/utils';

import { supabase } from '../supabaseClient';

export interface UsePatternDebtOptions {
  /** Recent window the debt is computed over. Defaults to the SQL default (14). */
  windowDays?: number;
  /** Trailing window used to establish the volume baseline. Defaults to 84. */
  baselineDays?: number;
}

/** One row as returned by the `pattern_debt_movements` RPC. */
interface PatternDebtMovementRow {
  movement_id: string | null;
  movement_name: string;
  pattern_credits: string[] | null;
  last_trained_at: string | null;
  set_count: number | string;
  total_reps: number | string;
  total_volume_kg: number | string;
  baseline_volume_kg: number | string | null;
  hardest_rpe: PatternRpe | null;
}

/**
 * Free-tier pattern balance. Calls the `pattern_debt_movements` RPC for the
 * raw per-movement aggregates, then applies the shared scoring model.
 */
export const usePatternDebt = ({
  windowDays,
  baselineDays,
}: UsePatternDebtOptions = {}) => {
  const session = useSession();
  const userId = session?.user?.id;

  return useQuery<PatternBalance>({
    queryKey: [QUERIES.PATTERN_DEBT, userId, windowDays, baselineDays],
    queryFn: () => fetchPatternDebt(windowDays, baselineDays),
    enabled: !!userId,
  });
};

const fetchPatternDebt = async (
  windowDays?: number,
  baselineDays?: number,
): Promise<PatternBalance> => {
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
    last_trained_at: row.last_trained_at,
    set_count: Number(row.set_count),
    total_reps: Number(row.total_reps),
    total_volume_kg: Number(row.total_volume_kg),
    baseline_volume_kg:
      row.baseline_volume_kg == null ? null : Number(row.baseline_volume_kg),
    hardest_rpe: row.hardest_rpe ?? null,
  }));

  return computePatternBalance(aggregates);
};
