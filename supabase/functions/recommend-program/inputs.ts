// recommend-program: assemble the standalone RecommenderInputs.
//
// The service-role client (bypasses RLS) handles the user-scoped reads; the
// caller's JWT-bound client is needed only for `pattern_debt_movements`, which
// is SECURITY INVOKER and filters on auth.uid() internally.

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  assessStackFit,
  computePatternBalance,
  type MovementAggregate,
  type ProgramSystemicDemand,
  type StackProgram,
} from './scoring.ts';
import type {
  ActiveProgramSummary,
  CandidateProgram,
  PatternDebtInput,
  QueuedProgramSummary,
  RecommenderInputs,
  WorkoutSummary,
} from './types.ts';

const HISTORY_LIMIT = 10;

export const MAX_ACTIVE_PROGRAMS = 3;

interface ProgramRow {
  id: string;
  source_program_id: string | null;
  title: string;
  description: string | null;
  focus_tags: string[] | null;
  systemic_demand: ProgramSystemicDemand | null;
}

const toStackProgram = (p: ProgramRow): StackProgram => ({
  title: p.title,
  focusTags: p.focus_tags ?? [],
  systemicDemand: p.systemic_demand,
});

export async function gatherInputs(
  admin: SupabaseClient,
  userClient: SupabaseClient,
  userId: string,
): Promise<RecommenderInputs> {
  // Live enrollments: what's running plus what's queued.
  const { data: enrollments, error: enrErr } = await admin
    .from('user_programs')
    .select('id, program_id, status, queue_position')
    .eq('user_id', userId)
    .in('status', ['active', 'queued'])
    .order('queue_position', { ascending: true, nullsFirst: true });
  if (enrErr) throw enrErr;

  const activeEnrollments = (enrollments ?? []).filter(
    (e) => e.status === 'active',
  );
  const queuedEnrollments = (enrollments ?? []).filter(
    (e) => e.status === 'queued',
  );

  const enrolledProgramIds = (enrollments ?? []).map((e) => e.program_id);
  let enrolledPrograms: ProgramRow[] = [];
  if (enrolledProgramIds.length > 0) {
    const { data, error } = await admin
      .from('programs')
      .select('id, source_program_id, title, description, focus_tags, systemic_demand')
      .in('id', enrolledProgramIds);
    if (error) throw error;
    enrolledPrograms = (data ?? []) as ProgramRow[];
  }
  const programById = new Map(enrolledPrograms.map((p) => [p.id, p]));

  // Candidates: the released shared catalog, minus anything already running or
  // queued. Enrollment clones a shared program (source_program_id back-pointer),
  // so exclusion goes through both the clone's source and its own id.
  const takenSharedIds = new Set(
    enrolledPrograms.flatMap((p) =>
      p.source_program_id ? [p.source_program_id, p.id] : [p.id],
    ),
  );
  const { data: catalog, error: catErr } = await admin
    .from('programs')
    .select('id, source_program_id, title, description, focus_tags, systemic_demand')
    .eq('is_public', true)
    .not('released_at', 'is', null);
  if (catErr) throw catErr;

  const activeStack = activeEnrollments
    .map((e) => programById.get(e.program_id))
    .filter((p): p is ProgramRow => !!p)
    .map(toStackProgram);

  const candidatePrograms = ((catalog ?? []) as ProgramRow[]).filter(
    (p) => !takenSharedIds.has(p.id),
  );

  // Session counts for progress and candidate length, in one query.
  const countProgramIds = [
    ...candidatePrograms.map((p) => p.id),
    ...activeEnrollments.map((e) => e.program_id),
  ];
  const sessionCounts = new Map<string, number>();
  if (countProgramIds.length > 0) {
    const { data: sessionRows, error: sesErr } = await admin
      .from('program_sessions')
      .select('program_id')
      .in('program_id', countProgramIds);
    if (sesErr) throw sesErr;
    for (const row of sessionRows ?? []) {
      sessionCounts.set(
        row.program_id,
        (sessionCounts.get(row.program_id) ?? 0) + 1,
      );
    }
  }

  // Completions per active enrollment, for progress + last-worked.
  const completionsByEnrollment = new Map<
    string,
    { count: number; lastAt: string | null }
  >();
  if (activeEnrollments.length > 0) {
    const { data: completions, error: compErr } = await admin
      .from('program_session_completions')
      .select('user_program_id, completed_at')
      .in('user_program_id', activeEnrollments.map((e) => e.id));
    if (compErr) throw compErr;
    for (const row of completions ?? []) {
      const entry = completionsByEnrollment.get(row.user_program_id) ?? {
        count: 0,
        lastAt: null,
      };
      entry.count += 1;
      if (entry.lastAt === null || row.completed_at > entry.lastAt) {
        entry.lastAt = row.completed_at;
      }
      completionsByEnrollment.set(row.user_program_id, entry);
    }
  }

  const active_programs: ActiveProgramSummary[] = activeEnrollments.flatMap(
    (e) => {
      const program = programById.get(e.program_id);
      if (!program) return [];
      const done = completionsByEnrollment.get(e.id);
      return [
        {
          program_id: program.id,
          title: program.title,
          focus_tags: program.focus_tags ?? [],
          systemic_demand: program.systemic_demand,
          progress: `${done?.count ?? 0}/${sessionCounts.get(program.id) ?? 0}`,
          last_worked_at: done?.lastAt ?? null,
        },
      ];
    },
  );

  const queued_programs: QueuedProgramSummary[] = queuedEnrollments.flatMap(
    (e) => {
      const program = programById.get(e.program_id);
      return program
        ? [{ program_id: program.id, title: program.title }]
        : [];
    },
  );

  const candidates: CandidateProgram[] = candidatePrograms.map((p) => ({
    program_id: p.id,
    title: p.title,
    description: p.description,
    focus_tags: p.focus_tags ?? [],
    systemic_demand: p.systemic_demand,
    session_count: sessionCounts.get(p.id) ?? 0,
    stack_fit: assessStackFit(toStackProgram(p), activeStack),
  }));

  // Pattern debt: SECURITY INVOKER RPC, so it must run as the caller.
  // Generated DB types don't yet know this function — cast at the RPC
  // boundary only (mirrors src/api/usePatternDebt.ts).
  const { data: debtRows, error: debtErr } = await userClient.rpc(
    'pattern_debt_movements' as never,
  );
  if (debtErr) throw debtErr;

  const debtAggregates: MovementAggregate[] = (
    (debtRows ?? []) as Record<string, unknown>[]
  ).map((row) => ({
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
  }));

  const debtBalance = computePatternBalance(debtAggregates);
  const pattern_debt: PatternDebtInput = {
    overall_balance: debtBalance.overallBalance,
    patterns: Object.values(debtBalance.patterns).map((p) => ({
      pattern: p.pattern,
      days_since_last_trained:
        p.daysSinceLastTrained == null
          ? null
          : Math.floor(p.daysSinceLastTrained),
      debt_score: p.debtScore,
      band: p.band,
      hardest_rpe: p.hardestRpe,
      is_new: p.isNew,
    })),
  };

  // Recent workout history + persistent training goal.
  const { data: logs, error: logErr } = await admin
    .from('workout_logs')
    .select('id, completed_at, workout_goal, workout_goal_units, rpe')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
    .limit(HISTORY_LIMIT);
  if (logErr) throw logErr;

  const logIds = (logs ?? []).map((l) => l.id);
  const movementsByLog = new Map<number, string[]>();
  if (logIds.length > 0) {
    const { data: moves, error: mvErr } = await admin
      .from('movement_logs')
      .select('workout_log_id, movement_name')
      .in('workout_log_id', logIds);
    if (mvErr) throw mvErr;
    for (const m of moves ?? []) {
      const list = movementsByLog.get(m.workout_log_id) ?? [];
      list.push(m.movement_name);
      movementsByLog.set(m.workout_log_id, list);
    }
  }

  const recent_history: WorkoutSummary[] = (logs ?? []).map((l) => ({
    completed_at: l.completed_at,
    goal: `${l.workout_goal} ${l.workout_goal_units}`,
    rpe: l.rpe ?? null,
    movements: movementsByLog.get(l.id) ?? [],
  }));

  const days_since_last_workout =
    logs && logs.length > 0
      ? Math.floor(
          (Date.now() - new Date(logs[0].completed_at).getTime()) / 86_400_000,
        )
      : null;

  const { data: profile, error: profErr } = await admin
    .from('profiles')
    .select('training_goal')
    .eq('id', userId)
    .single();
  if (profErr) throw profErr;

  return {
    training_goal: profile?.training_goal ?? null,
    days_since_last_workout,
    slots_available: MAX_ACTIVE_PROGRAMS - activeEnrollments.length,
    active_programs,
    queued_programs,
    candidates,
    pattern_debt,
    recent_history,
  };
}
