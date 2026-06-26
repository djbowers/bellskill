// recommend-session (PROD-87): assemble the standalone RecommenderInputs.
//
// Uses the service-role client (bypasses RLS) but every query is scoped to the
// authenticated user_id. pattern_debt / unlocked_weights are stubbed empty here
// (PROD-75 / PROD-78).

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  CandidateMovement,
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

export async function gatherInputs(
  admin: SupabaseClient,
  userId: string,
  body: { readiness?: unknown },
): Promise<RecommenderInputs> {
  const readiness =
    typeof body.readiness === 'string' && body.readiness.trim()
      ? body.readiness.trim()
      : null;

  // Candidate movements: the user's own library.
  const { data: userMovements, error: umErr } = await admin
    .from('user_movements')
    .select('id, canonical_name, is_big_6')
    .eq('user_id', userId);
  if (umErr) throw umErr;

  const candidates: CandidateMovement[] = (userMovements ?? []).map((m) => ({
    user_movement_id: m.id,
    name: m.canonical_name,
    is_big_6: Boolean(m.is_big_6),
  }));

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
      ? Math.floor(
          (Date.now() - new Date(logs[0].completed_at).getTime()) / 86_400_000,
        )
      : null;

  return {
    training_goal: profile?.training_goal ?? null,
    readiness,
    days_since_last_workout,
    recent_history,
    candidates,
    pattern_debt: [],
    unlocked_weights: {},
  };
}
