import { useQuery } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { useSession } from '~/contexts';
import {
  Pattern,
  PatternAggregate,
  PatternBalance,
  computePatternBalance,
} from '~/utils';

import { supabase } from '../supabaseClient';

export interface UsePatternDebtOptions {
  /** Recent window the debt is computed over. Defaults to the SQL default (14). */
  windowDays?: number;
  /** Trailing window used to establish the volume baseline. Defaults to 84. */
  baselineDays?: number;
}

/**
 * Free-tier pattern balance. Calls the `pattern_debt_window` RPC for the raw
 * per-pattern aggregates, then applies the shared scoring model.
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
  const { data, error } = await supabase.rpc('pattern_debt_window', {
    ...(windowDays != null ? { p_window_days: windowDays } : {}),
    ...(baselineDays != null ? { p_baseline_days: baselineDays } : {}),
  });

  if (error) {
    console.error(error);
    throw error;
  }

  const aggregates: PatternAggregate[] = (data ?? []).map((row) => ({
    pattern: row.pattern as Pattern,
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
