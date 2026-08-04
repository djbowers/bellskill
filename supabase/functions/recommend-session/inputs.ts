// recommend-session (PROD-87): assemble the standalone RecommenderInputs.
//
// Uses the service-role client (bypasses RLS) but every query is scoped to the
// authenticated user_id — except pattern debt, which goes through the caller's
// JWT client because pattern_debt_movements is SECURITY INVOKER and filters on
// auth.uid(). unlocked_weights comes from the user's declared equipment (PROD-78).

import type { SupabaseClient } from '@supabase/supabase-js';

import { gatherEquipment } from '../_shared/equipmentInput.ts';
import {
  daysBetweenCalendarDays,
  parseLocalDateString,
} from '../../../src/utils/dateOnly.ts';
import {
  type MovementAggregate,
  attributeMovement,
  computePatternBalance,
  selectBalanceTargets,
} from '../../../src/utils/patternDebt.ts';
import type {
  CandidateMovement,
  PatternDebtInput,
  RecommendMode,
  RecommenderInputs,
  WorkoutHistoryEntry,
} from './types.ts';

const HISTORY_LIMIT = 5;
const LB_TO_KG = 0.453592;

function toKg(value: number | null, unit: string | null): number | null {
  if (value == null) return null;
  const kg = unit === 'pounds' ? value * LB_TO_KG : value;
  return Math.round(kg * 2) / 2; // nearest 0.5 kg
}

function formatGoal(goal: number, units: string): string {
  return `${goal} ${units}`;
}

/**
 * Fetch and score the caller's pattern-debt balance. Best-effort: any failure
 * degrades to null so a recommendation is never blocked on it.
 */
async function gatherPatternDebt(
  authClient: SupabaseClient,
  today: Date,
): Promise<PatternDebtInput | null> {
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
        last_trained_at: row.last_trained_at as string | null,
        set_count: Number(row.set_count),
        total_reps: Number(row.total_reps),
        total_volume_kg: Number(row.total_volume_kg),
        baseline_volume_kg:
          row.baseline_volume_kg == null ? null : Number(row.baseline_volume_kg),
        hardest_rpe: (row.hardest_rpe ?? null) as MovementAggregate['hardest_rpe'],
      }),
    );

    const balance = computePatternBalance(aggregates, today);
    return {
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
    };
  } catch (err) {
    console.error('recommend-session pattern_debt fetch failed:', err);
    return null;
  }
}

export async function gatherInputs(
  admin: SupabaseClient,
  authClient: SupabaseClient,
  userId: string,
  body: { readiness?: unknown; client_today?: unknown; mode?: unknown },
): Promise<RecommenderInputs> {
  const mode: RecommendMode = body.mode === 'balance' ? 'balance' : 'default';
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

  // Candidate movements: the user's own library, with catalog pattern credits
  // joined for the prompt annotations and balance-mode coverage validation.
  const { data: userMovements, error: umErr } = await admin
    .from('user_movements')
    .select('id, canonical_name, is_big_6, functional_movement_id')
    .eq('user_id', userId);
  if (umErr) throw umErr;

  const catalogIds = [
    ...new Set(
      (userMovements ?? [])
        .map((m) => m.functional_movement_id)
        .filter((id): id is string => id != null),
    ),
  ];
  const creditsByCatalogId = new Map<string, string[]>();
  const doublesByCatalogId = new Map<string, boolean>();
  if (catalogIds.length > 0) {
    const { data: catalogRows, error: catErr } = await admin
      .from('movements')
      .select('id, pattern_credits, "# Primary Items"')
      .in('id', catalogIds);
    if (catErr) throw catErr;
    for (const row of catalogRows ?? []) {
      creditsByCatalogId.set(row.id, row.pattern_credits);
      doublesByCatalogId.set(row.id, row['# Primary Items'] === 2);
    }
  }

  const candidates: CandidateMovement[] = (userMovements ?? []).map((m) => {
    // attributeMovement applies the shared unlinked-movement policy (get-up
    // name fallback) and filters credits to the known coarse patterns.
    const credited = attributeMovement(
      creditsByCatalogId.get(m.functional_movement_id ?? '') ?? null,
      m.canonical_name,
    );
    return {
      user_movement_id: m.id,
      name: m.canonical_name,
      is_big_6: Boolean(m.is_big_6),
      pattern_credits: credited.length > 0 ? credited : null,
      supports_doubles:
        doublesByCatalogId.get(m.functional_movement_id ?? '') ?? null,
    };
  });

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
      .select('workout_log_id, movement_name, rep_scheme, weight_one_value, weight_one_unit')
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

  const pattern_debt = await gatherPatternDebt(authClient, clientToday);
  const equipment = await gatherEquipment(admin, userId);

  // Balance mode's deterministic targets. Degrades to [] (default behavior)
  // when debt is unavailable or nothing red is coverable from the library.
  const balance_targets =
    mode === 'balance' && pattern_debt
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
    mode,
    balance_targets,
    training_goal: profile?.training_goal ?? null,
    readiness,
    days_since_last_workout,
    recent_history,
    candidates,
    pattern_debt,
    unlocked_weights: equipment ?? {},
  };
}
