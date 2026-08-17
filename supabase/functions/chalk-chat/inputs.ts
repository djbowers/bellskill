// chalk-chat: assemble everything Chalk knows about the lifter for one turn.
//
// Reassembled fresh on every message rather than cached per thread: the whole
// value of Chalk is that it knows current state, and a lifter can log a workout
// mid-conversation. These are all indexed, user-scoped reads run in parallel.
//
// Uses the service-role client (bypasses RLS) with every query scoped to the
// authenticated user_id — except pattern debt, which must go through the
// caller's JWT client because pattern_debt_movements is SECURITY INVOKER and
// filters on auth.uid() internally.

import type { SupabaseClient } from '@supabase/supabase-js';

import { gatherEquipment } from '../_shared/equipmentInput.ts';
import {
  daysBetweenCalendarDays,
  parseLocalDateString,
} from '../../../src/utils/dateOnly.ts';
import { computeModalityBalance } from '../../../src/utils/modalityDebt.ts';
import {
  type MovementAggregate,
  attributeMovement,
  computePatternBalance,
} from '../../../src/utils/patternDebt.ts';
import type {
  CatalogProgram,
  ChalkContext,
  EnrolledProgram,
  LibraryMovement,
  ModalityDebtInput,
  PatternDebtInput,
  WorkoutHistoryEntry,
} from './types.ts';

/** Chat asks broader questions than "what's my next session", so more than the
 *  recommender's 5 — but still bounded. */
const HISTORY_LIMIT = 10;
const HISTORY_MAX_AGE_DAYS = 90;
const LONG_RANGE_DAYS = 365;
const TOP_MOVEMENT_LIMIT = 5;
const LB_TO_KG = 0.453592;

/** Caps on any user-authored string that reaches the prompt. */
const MAX_NAME_CHARS = 120;
const MAX_NOTE_CHARS = 600;

/**
 * Every field below originates as user input and lands in a system-adjacent
 * context block, so strip control characters (which could fake a delimiter or
 * a role marker) and bound the length. The `<user_context>` wrapper plus the
 * system prompt's data-not-instructions rule are the other two layers.
 */
function sanitize(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  const stripped = value
    // Matching control characters is the point here: raw C0 bytes or DEL in a
    // movement name could fake a delimiter or a role marker in the prompt.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!stripped) return null;
  return stripped.length > max ? `${stripped.slice(0, max)}…` : stripped;
}

function toKg(value: number | null, unit: string | null): number | null {
  if (value == null) return null;
  const kg = unit === 'pounds' ? value * LB_TO_KG : value;
  return Math.round(kg * 2) / 2;
}

/**
 * Fetch and score both balance axes from one RPC round trip — the aggregation
 * returns pattern_credits and modality_credits side by side. Best-effort: any
 * failure degrades to nulls so a reply is never blocked on it, matching
 * recommend-session's contract.
 */
async function gatherBalances(
  authClient: SupabaseClient,
  today: Date,
): Promise<{
  pattern_debt: PatternDebtInput | null;
  modality_debt: ModalityDebtInput | null;
}> {
  try {
    // Generated DB types don't know this function — cast at the RPC boundary
    // only (mirrors src/api/usePatternDebt.ts and recommend-session).
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
          row.baseline_volume_kg == null ? null : Number(row.baseline_volume_kg),
        hardest_rpe: (row.hardest_rpe ?? null) as MovementAggregate['hardest_rpe'],
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
          is_new: m.isNew,
        })),
      },
    };
  } catch (err) {
    console.error('chalk-chat balance fetch failed:', err);
    return { pattern_debt: null, modality_debt: null };
  }
}

async function gatherHistory(
  admin: SupabaseClient,
  userId: string,
  clientToday: Date,
): Promise<{
  recent: WorkoutHistoryEntry[];
  daysSinceLast: number | null;
}> {
  const cutoff = new Date(clientToday);
  cutoff.setDate(cutoff.getDate() - HISTORY_MAX_AGE_DAYS);

  const { data: logs, error } = await admin
    .from('workout_logs')
    .select(
      'id, completed_at, workout_goal, workout_goal_units, rpe, pre_workout_notes, post_workout_notes',
    )
    .eq('user_id', userId)
    .gte('completed_at', cutoff.toISOString())
    .order('completed_at', { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw error;

  const logIds = (logs ?? []).map((l) => l.id);
  const movementsByLog = new Map<number, WorkoutHistoryEntry['movements']>();
  if (logIds.length > 0) {
    const { data: moves, error: mvErr } = await admin
      .from('movement_logs')
      .select(
        'workout_log_id, movement_name, rep_scheme, weight_one_value, weight_one_unit',
      )
      .in('workout_log_id', logIds);
    if (mvErr) throw mvErr;

    for (const m of moves ?? []) {
      const list = movementsByLog.get(m.workout_log_id) ?? [];
      list.push({
        name: sanitize(m.movement_name, MAX_NAME_CHARS) ?? 'unnamed movement',
        rep_scheme: m.rep_scheme ?? [],
        weight_kg: toKg(m.weight_one_value, m.weight_one_unit),
      });
      movementsByLog.set(m.workout_log_id, list);
    }
  }

  const recent: WorkoutHistoryEntry[] = (logs ?? []).map((l) => ({
    completed_at: l.completed_at,
    goal: `${l.workout_goal} ${l.workout_goal_units}`,
    rpe: l.rpe ?? null,
    pre_notes: sanitize(l.pre_workout_notes, MAX_NOTE_CHARS),
    post_notes: sanitize(l.post_workout_notes, MAX_NOTE_CHARS),
    movements: movementsByLog.get(l.id) ?? [],
  }));

  const daysSinceLast =
    recent.length > 0
      ? daysBetweenCalendarDays(new Date(recent[0].completed_at), clientToday)
      : null;

  return { recent, daysSinceLast };
}

/**
 * One aggregate line for "am I training more than last year" questions, without
 * pulling a year of rows into the prompt. Best-effort.
 */
async function gatherLongRange(
  admin: SupabaseClient,
  userId: string,
  clientToday: Date,
): Promise<ChalkContext['long_range']> {
  try {
    const cutoff = new Date(clientToday);
    cutoff.setDate(cutoff.getDate() - LONG_RANGE_DAYS);

    const { data: logs, error } = await admin
      .from('workout_logs')
      .select('id')
      .eq('user_id', userId)
      .gte('completed_at', cutoff.toISOString());
    if (error) throw error;

    const ids = (logs ?? []).map((l) => l.id);
    if (ids.length === 0) return null;

    const { data: moves, error: mvErr } = await admin
      .from('movement_logs')
      .select('movement_name')
      .in('workout_log_id', ids);
    if (mvErr) throw mvErr;

    const counts = new Map<string, number>();
    for (const m of moves ?? []) {
      const name = sanitize(m.movement_name, MAX_NAME_CHARS);
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }

    return {
      sessions_12mo: ids.length,
      sessions_per_week: Math.round((ids.length / (LONG_RANGE_DAYS / 7)) * 10) / 10,
      top_movements: [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, TOP_MOVEMENT_LIMIT)
        .map(([name, set_count]) => ({ name, set_count })),
    };
  } catch (err) {
    console.error('chalk-chat long-range fetch failed:', err);
    return null;
  }
}

async function gatherLibrary(
  admin: SupabaseClient,
  userId: string,
): Promise<LibraryMovement[]> {
  const { data: userMovements, error } = await admin
    .from('user_movements')
    .select('canonical_name, is_big_6, functional_movement_id')
    .eq('user_id', userId);
  if (error) throw error;

  const catalogIds = [
    ...new Set(
      (userMovements ?? [])
        .map((m) => m.functional_movement_id)
        .filter((id): id is string => id != null),
    ),
  ];

  const creditsByCatalogId = new Map<string, string[]>();
  if (catalogIds.length > 0) {
    const { data: catalogRows, error: catErr } = await admin
      .from('movements')
      .select('id, pattern_credits')
      .in('id', catalogIds);
    if (catErr) throw catErr;
    for (const row of catalogRows ?? []) {
      creditsByCatalogId.set(row.id, row.pattern_credits);
    }
  }

  return (userMovements ?? []).map((m) => {
    // attributeMovement applies the shared unlinked-movement policy (get-up
    // name fallback) and filters to the known coarse patterns.
    const credited = attributeMovement(
      creditsByCatalogId.get(m.functional_movement_id ?? '') ?? null,
      m.canonical_name,
    );
    return {
      name: sanitize(m.canonical_name, MAX_NAME_CHARS) ?? 'unnamed movement',
      is_big_6: Boolean(m.is_big_6),
      pattern_credits: credited.length > 0 ? credited : null,
    };
  });
}

async function gatherPrograms(
  admin: SupabaseClient,
  userId: string,
): Promise<{ enrolled: EnrolledProgram[]; catalog: CatalogProgram[] }> {
  const { data: enrollments, error } = await admin
    .from('user_programs')
    .select('program_id, status')
    .eq('user_id', userId)
    .in('status', ['active', 'queued']);
  if (error) throw error;

  const enrolledIds = (enrollments ?? []).map((e) => e.program_id);
  let enrolled: EnrolledProgram[] = [];
  const takenIds = new Set<string>();

  if (enrolledIds.length > 0) {
    const { data: rows, error: progErr } = await admin
      .from('programs')
      .select('id, source_program_id, title, focus_tags')
      .in('id', enrolledIds);
    if (progErr) throw progErr;

    const byId = new Map((rows ?? []).map((p) => [p.id, p]));
    for (const p of rows ?? []) {
      takenIds.add(p.id);
      // Enrollment clones a shared program, so exclude via the back-pointer too.
      if (p.source_program_id) takenIds.add(p.source_program_id);
    }

    enrolled = (enrollments ?? [])
      .map((e) => {
        const p = byId.get(e.program_id);
        if (!p) return null;
        return {
          title: sanitize(p.title, MAX_NAME_CHARS) ?? 'untitled program',
          status: e.status as EnrolledProgram['status'],
          focus_tags: p.focus_tags ?? [],
        };
      })
      .filter((p): p is EnrolledProgram => p !== null);
  }

  // Catalog: title + focus tags only. `description` is long and titles are
  // enough for Chalk to suggest one.
  const { data: catalogRows, error: catErr } = await admin
    .from('programs')
    .select('id, title, focus_tags')
    .eq('is_public', true)
    .not('released_at', 'is', null);
  if (catErr) throw catErr;

  const catalog: CatalogProgram[] = (catalogRows ?? [])
    .filter((p) => !takenIds.has(p.id))
    .map((p) => ({
      title: sanitize(p.title, MAX_NAME_CHARS) ?? 'untitled program',
      focus_tags: p.focus_tags ?? [],
    }));

  return { enrolled, catalog };
}

export async function gatherContext(
  admin: SupabaseClient,
  authClient: SupabaseClient,
  userId: string,
  body: { client_today?: unknown },
): Promise<ChalkContext> {
  // "Today" must be the caller's local calendar date: this runs in a Deno edge
  // runtime with no timezone of its own, and a server clock both floats on UTC
  // boundaries and can't distinguish "0 days elapsed" from "trained last
  // evening" — see docs/pattern-debt-scoring-model.md.
  const parsedClientToday =
    typeof body.client_today === 'string'
      ? parseLocalDateString(body.client_today)
      : null;
  if (parsedClientToday === null) {
    console.warn(
      'chalk-chat: missing/invalid client_today, falling back to server clock',
    );
  }
  const clientToday = parsedClientToday ?? new Date();

  const [profileResult, history, longRange, library, programs, balances, equipment] =
    await Promise.all([
      admin.from('profiles').select('training_goal').eq('id', userId).single(),
      gatherHistory(admin, userId, clientToday),
      gatherLongRange(admin, userId, clientToday),
      gatherLibrary(admin, userId),
      gatherPrograms(admin, userId),
      gatherBalances(authClient, clientToday),
      gatherEquipment(admin, userId),
    ]);

  if (profileResult.error) throw profileResult.error;

  return {
    training_goal: sanitize(profileResult.data?.training_goal, MAX_NOTE_CHARS),
    days_since_last_workout: history.daysSinceLast,
    recent_history: history.recent,
    long_range: longRange,
    pattern_debt: balances.pattern_debt,
    modality_debt: balances.modality_debt,
    library,
    enrolled_programs: programs.enrolled,
    catalog_programs: programs.catalog,
    equipment,
  };
}
