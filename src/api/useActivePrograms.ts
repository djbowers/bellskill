import { useQuery } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { useSession } from '~/contexts';
import { Program, ProgramSession, UserProgram, WorkoutOptions } from '~/types';

import { supabase } from '../supabaseClient';
import {
  mapProgramRow,
  mapProgramSessionRow,
  mapUserProgramRow,
} from './program';

/** The most programs a user may run at once (`one_program_per_active_slot`). */
export const MAX_ACTIVE_PROGRAMS = 3;

export interface NextProgramSession {
  session: ProgramSession;
  /** The stored session options, ready for `loadIntoBuilder` with no mapping. */
  workoutOptions: Omit<WorkoutOptions, 'startedAt'>;
}

export interface ProgramProgress {
  /** Sessions satisfied (completed or skipped). */
  completed: number;
  /** Total sessions in the program. */
  total: number;
  /** 1-based week of the current session (the next one, or the last when done). */
  week: number;
  /** 1-based day of the current session. */
  day: number;
}

export interface ActiveProgram {
  enrollment: UserProgram;
  program: Program;
  /**
   * The next unsatisfied session (lowest `sequenceIndex` with no completion), or
   * `null` when every session is satisfied.
   */
  nextSession: NextProgramSession | null;
  progress: ProgramProgress;
  /** True once every session has a completion (or the enrollment is completed). */
  isComplete: boolean;
  /**
   * When this enrollment last had a session satisfied, or `null` if none yet.
   * Drives which program Home offers first.
   */
  lastWorkedAt: string | null;
}

interface UseActiveProgramsOptions {
  /**
   * Gate the query. Defaults to enabled — pass `false` (e.g. behind the
   * `programs` flag) so non-program builds fire zero extra requests.
   */
  enabled?: boolean;
}

/**
 * The user's current programs — up to {@link MAX_ACTIVE_PROGRAMS} running in
 * parallel, each with its own independent cursor. Ordered
 * **least-recently-worked first**, so `[0]` is the program Home offers by
 * default and a brand-new enrollment (no completions yet) surfaces immediately.
 *
 * When nothing is active this falls back to the single most-recently-completed
 * enrollment, so the "🎉 complete" card still renders after the final session
 * flips the enrollment to `completed`. Returns `[]` when the user has neither.
 *
 * Per program, `nextSession` is the lowest-`sequenceIndex` session with no
 * completion row (the §3.6 "next unsatisfied session" query, evaluated
 * client-side over each program's ≤~20 sessions — small enough that a dedicated
 * SQL function buys nothing over a plain multi-select). Skips get a `skipped`
 * completion, so they are satisfied and never re-served.
 */
export const useActivePrograms = (options?: UseActiveProgramsOptions) => {
  const session = useSession();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: [QUERIES.ACTIVE_PROGRAM, userId],
    queryFn: () => fetchActivePrograms(userId!),
    enabled: !!userId && (options?.enabled ?? true),
  });
};

const fetchActivePrograms = async (
  userId: string,
): Promise<ActiveProgram[]> => {
  const { data: enrollments, error } = await supabase
    .from('user_programs')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['active', 'completed'])
    .order('completed_at', { ascending: false, nullsFirst: true });

  if (error) throw error;

  const active = (enrollments ?? []).filter((row) => row.status === 'active');
  // Only fall back to the completed enrollment when nothing is running — with a
  // live program in another slot, Home has something better to show.
  const rows = active.length > 0 ? active : (enrollments ?? []).slice(0, 1);
  if (rows.length === 0) return [];

  const programs = await Promise.all(rows.map(buildActiveProgram));

  return programs.sort(byLeastRecentlyWorked);
};

/** Nulls (never worked) first, then oldest completion first; slot breaks ties. */
const byLeastRecentlyWorked = (a: ActiveProgram, b: ActiveProgram): number => {
  if (a.lastWorkedAt !== b.lastWorkedAt) {
    if (a.lastWorkedAt === null) return -1;
    if (b.lastWorkedAt === null) return 1;
    return a.lastWorkedAt < b.lastWorkedAt ? -1 : 1;
  }
  return (a.enrollment.activeSlot ?? 0) - (b.enrollment.activeSlot ?? 0);
};

type EnrollmentRow = Parameters<typeof mapUserProgramRow>[0];

const buildActiveProgram = async (
  enrollmentRow: EnrollmentRow,
): Promise<ActiveProgram> => {
  const [programResult, sessionsResult, completionsResult] = await Promise.all([
    supabase
      .from('programs')
      .select('*')
      .eq('id', enrollmentRow.program_id)
      .single(),
    supabase
      .from('program_sessions')
      .select('*')
      .eq('program_id', enrollmentRow.program_id)
      .order('sequence_index', { ascending: true }),
    supabase
      .from('program_session_completions')
      .select('program_session_id, completed_at')
      .eq('user_program_id', enrollmentRow.id),
  ]);

  if (programResult.error) throw programResult.error;
  if (sessionsResult.error) throw sessionsResult.error;
  if (completionsResult.error) throw completionsResult.error;

  const enrollment = mapUserProgramRow(enrollmentRow);
  const program = mapProgramRow(programResult.data);
  const sessions = (sessionsResult.data ?? []).map(mapProgramSessionRow);
  const completions = completionsResult.data ?? [];
  const satisfiedIds = new Set(
    completions.map((row) => row.program_session_id),
  );

  const total = sessions.length;
  const completed = sessions.filter((s) => satisfiedIds.has(s.id)).length;
  const nextSessionRow = sessions.find((s) => !satisfiedIds.has(s.id)) ?? null;
  const isComplete =
    enrollment.status === 'completed' || nextSessionRow === null;

  // The "current" session for labels: the next unsatisfied one, or the last
  // session once complete.
  const labelSession = nextSessionRow ?? sessions[sessions.length - 1] ?? null;

  const nextSession: NextProgramSession | null = nextSessionRow
    ? { session: nextSessionRow, workoutOptions: nextSessionRow.workoutOptions }
    : null;

  const lastWorkedAt = completions.reduce<string | null>(
    (latest, row) =>
      latest === null || row.completed_at > latest ? row.completed_at : latest,
    null,
  );

  return {
    enrollment,
    program,
    nextSession,
    progress: {
      completed,
      total,
      week: labelSession?.weekNumber ?? 0,
      day: labelSession?.dayNumber ?? 0,
    },
    isComplete,
    lastWorkedAt,
  };
};
