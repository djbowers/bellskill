// recommend-session (PROD-87): assemble the standalone RecommenderInputs.
//
// Uses the service-role client (bypasses RLS) but every query is scoped to the
// authenticated user_id — except pattern debt, which goes through the caller's
// JWT client because pattern_debt_movements is SECURITY INVOKER and filters on
// auth.uid(). unlocked_weights comes from the user's declared equipment (PROD-78).
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  daysBetweenCalendarDays,
  parseLocalDateString,
} from '../../../src/utils/dateOnly.ts';
import { computeModalityBalance } from '../../../src/utils/modalityDebt.ts';
import {
  type MovementAggregate,
  attributeMovement,
  computePatternBalance,
  selectBalanceTargets,
} from '../../../src/utils/patternDebt.ts';
import { gatherEquipment } from '../_shared/equipmentInput.ts';
import type {
  CandidateMovement,
  ModalityDebtInput,
  PatternDebtInput,
  RecommenderInputs,
  WorkoutHistoryEntry,
} from './types.ts';

const HISTORY_LIMIT = 5;
const LB_TO_KG = 0.453592;
const BODYWEIGHT_EQUIPMENT = 'Bodyweight';

/** The catalog columns a candidate is built from (`movements` table). */
export interface CatalogRow {
  id: string;
  Movement: string;
  pattern_credits: string[] | null;
  'Primary Equipment': string | null;
  '# Primary Items': number | null;
  unilateral_lower: boolean | null;
}

/** Catalog rows → the candidate set, in a stable name order for the prompt. */
export function toCandidates(rows: CatalogRow[]): CandidateMovement[] {
  return rows
    .slice()
    .sort((a, b) => a.Movement.localeCompare(b.Movement))
    .map((row) => {
      const credited = attributeMovement(row.pattern_credits, row.Movement);
      return {
        movement_id: row.id,
        name: row.Movement,
        pattern_credits: credited.length > 0 ? credited : null,
        bodyweight: row['Primary Equipment'] === BODYWEIGHT_EQUIPMENT,
        supports_doubles: row['# Primary Items'] === 2,
        unilateral_lower: Boolean(row.unilateral_lower),
      };
    });
}

function toKg(value: number | null, unit: string | null): number | null {
  if (value == null) return null;
  const kg = unit === 'pounds' ? value * LB_TO_KG : value;
  return Math.round(kg * 2) / 2; // nearest 0.5 kg
}

function formatGoal(goal: number, units: string): string {
  return `${goal} ${units}`;
}

/**
 * Fetch and score both balance axes. One RPC round trip serves both: the
 * aggregation returns pattern_credits and modality_credits side by side, and
 * each scorer applies its own model. Best-effort: any failure degrades to nulls
 * so a recommendation is never blocked on it.
 */
async function gatherBalances(
  authClient: SupabaseClient,
  today: Date,
): Promise<{
  pattern_debt: PatternDebtInput | null;
  modality_debt: ModalityDebtInput | null;
}> {
  try {
    // Generated DB types don't yet know this function — cast at the RPC
    // boundary only (mirrors src/api/usePatternDebt.ts).
    const { data, error } = await authClient.rpc(
      'pattern_debt_movements' as never,
    );
    if (error) throw error;

    const aggregates: MovementAggregate[] = (data ?? []).map(
      (row: Record<string, unknown>) => ({
        movement_id: (row.movement_id ?? null) as string | null,
        movement_name: row.movement_name as string,
        pattern_credits: (row.pattern_credits ?? null) as string[] | null,
        modality_credits: (row.modality_credits ?? null) as string[] | null,
        last_trained_at: row.last_trained_at as string | null,
        set_count: Number(row.set_count),
        total_reps: Number(row.total_reps),
        total_volume_kg: Number(row.total_volume_kg),
        baseline_volume_kg:
          row.baseline_volume_kg == null
            ? null
            : Number(row.baseline_volume_kg),
        hardest_rpe: (row.hardest_rpe ??
          null) as MovementAggregate['hardest_rpe'],
        total_unloaded_reps: Number(row.total_unloaded_reps ?? 0),
        baseline_unloaded_reps:
          row.baseline_unloaded_reps == null
            ? null
            : Number(row.baseline_unloaded_reps),
        total_seconds: Number(row.total_seconds ?? 0),
        baseline_seconds:
          row.baseline_seconds == null ? null : Number(row.baseline_seconds),
      }),
    );

    const balance = computePatternBalance(aggregates, today);
    const modalityBalance = computeModalityBalance(aggregates, today);
    return {
      pattern_debt: {
        overall_balance: balance.overallBalance,
        patterns: Object.values(balance.patterns).map((p) => ({
          pattern: p.pattern,
          days_since_last_trained:
            p.daysSinceLastTrained == null
              ? null
              : Math.floor(p.daysSinceLastTrained),
          recent_volume_kg: p.recentVolume,
          baseline_volume_kg: p.baselineVolume,
          debt_score: p.debtScore,
          band: p.band,
          hardest_rpe: p.hardestRpe,
          is_new: p.isNew,
        })),
      },
      modality_debt: {
        overall_balance: modalityBalance.overallBalance,
        modalities: Object.values(modalityBalance.modalities).map((m) => ({
          modality: m.modality,
          days_since_last_trained:
            m.daysSinceLastTrained == null
              ? null
              : Math.floor(m.daysSinceLastTrained),
          recent_volume_kg: m.recentVolume,
          baseline_volume_kg: m.baselineVolume,
          debt_score: m.debtScore,
          band: m.band,
          hardest_rpe: m.hardestRpe,
          is_new: m.isNew,
        })),
      },
    };
  } catch (err) {
    console.error('recommend-session balance fetch failed:', err);
    return { pattern_debt: null, modality_debt: null };
  }
}

export async function gatherInputs(
  admin: SupabaseClient,
  authClient: SupabaseClient,
  userId: string,
  // Stale clients may still send a `mode` field; it is accepted and ignored.
  body: { readiness?: unknown; client_today?: unknown },
): Promise<RecommenderInputs> {
  const readiness =
    typeof body.readiness === 'string' && body.readiness.trim()
      ? body.readiness.trim()
      : null;

  // "Today" must be the caller's local calendar date: this function runs in a
  // Deno edge runtime with no timezone of its own, and a server-clock `Date.now()`
  // both floats on UTC boundaries and can't distinguish "0 days elapsed" from
  // "worked out yesterday evening" — see docs/pattern-debt-scoring-model.md.
  const parsedClientToday =
    typeof body.client_today === 'string'
      ? parseLocalDateString(body.client_today)
      : null;
  if (parsedClientToday === null) {
    console.warn(
      'recommend-session: missing/invalid client_today, falling back to server clock',
    );
  }
  const clientToday = parsedClientToday ?? new Date();

  // Candidate movements: the whole catalog, kettlebell and bodyweight. Custom
  // (unlinked) library movements are deliberately excluded (PROD-85).
  const { data: catalogRows, error: catErr } = await admin
    .from('movements')
    .select(
      'id, Movement, pattern_credits, "Primary Equipment", "# Primary Items", unilateral_lower',
    )
    .order('Movement');
  if (catErr) throw catErr;
  const candidates = toCandidates(catalogRows ?? []);

  // Persistent training goal.
  const { data: profile, error: profErr } = await admin
    .from('profiles')
    .select('training_goal')
    .eq('id', userId)
    .single();
  if (profErr) throw profErr;

  // Recent workout history.
  const { data: logs, error: logErr } = await admin
    .from('workout_logs')
    .select('id, completed_at, workout_goal, workout_goal_units, rpe')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
    .limit(HISTORY_LIMIT);
  if (logErr) throw logErr;

  const logIds = (logs ?? []).map((l) => l.id);
  let movementsByLog = new Map<number, WorkoutHistoryEntry['movements']>();
  if (logIds.length > 0) {
    const { data: moves, error: mvErr } = await admin
      .from('movement_logs')
      .select(
        'workout_log_id, movement_name, rep_scheme, weight_one_value, weight_one_unit',
      )
      .in('workout_log_id', logIds);
    if (mvErr) throw mvErr;

    movementsByLog = (moves ?? []).reduce((acc, m) => {
      const list = acc.get(m.workout_log_id) ?? [];
      list.push({
        name: m.movement_name,
        rep_scheme: m.rep_scheme ?? [],
        weight_kg: toKg(m.weight_one_value, m.weight_one_unit),
      });
      acc.set(m.workout_log_id, list);
      return acc;
    }, new Map<number, WorkoutHistoryEntry['movements']>());
  }

  const recent_history: WorkoutHistoryEntry[] = (logs ?? []).map((l) => ({
    completed_at: l.completed_at,
    goal: formatGoal(l.workout_goal, l.workout_goal_units),
    rpe: l.rpe ?? null,
    movements: movementsByLog.get(l.id) ?? [],
  }));

  const days_since_last_workout =
    logs && logs.length > 0
      ? daysBetweenCalendarDays(new Date(logs[0].completed_at), clientToday)
      : null;

  const { pattern_debt, modality_debt } = await gatherBalances(
    authClient,
    clientToday,
  );
  const equipment = await gatherEquipment(admin, userId);

  // Deterministic must-cover targets. Degrades to [] (no hard constraint)
  // when debt is unavailable or nothing red is coverable from the catalog.
  const balance_targets = pattern_debt
    ? selectBalanceTargets(
        pattern_debt.patterns.map((p) => ({
          pattern: p.pattern,
          band: p.band,
          debtScore: p.debt_score,
          isNew: p.is_new,
        })),
        candidates.map((c) => c.pattern_credits),
      )
    : [];

  return {
    balance_targets,
    training_goal: profile?.training_goal ?? null,
    readiness,
    days_since_last_workout,
    recent_history,
    candidates,
    pattern_debt,
    modality_debt,
    unlocked_weights: equipment ?? {},
  };
}
