import { useQuery } from 'react-query';

import { QUERIES } from '~/constants';
import { useSession } from '~/contexts';
import { Program, ProgramSession, UserProgram, WorkoutOptions } from '~/types';

import { supabase } from '../supabaseClient';
import {
  mapProgramRow,
  mapProgramSessionRow,
  mapUserProgramRow,
} from './program';

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
}

interface UseActiveProgramOptions {
  /**
   * Gate the query. Defaults to enabled — pass `false` (e.g. behind the
   * `programs` flag) so non-program builds fire zero extra requests.
   */
  enabled?: boolean;
}

/**
 * The user's current program: the active enrollment, or — when none is active —
 * the most recently completed one so the "🎉 complete" card can still render
 * after the final session flips the enrollment to `completed`. Returns `null`
 * when the user has neither.
 *
 * Beyond the enrollment/program (Slice 2), this derives the Slice-3 next-workout
 * surface: `nextSession` is the lowest-`sequenceIndex` session with no
 * completion row (the §3.6 "next unsatisfied session" query, evaluated
 * client-side over the program's ≤~15 sessions — small enough that a dedicated
 * SQL function buys nothing over a plain multi-select, and it stays consistent
 * with the existing enrollment fetch here). Skips get a `skipped` completion, so
 * they are satisfied and never re-served.
 */
export const useActiveProgram = (options?: UseActiveProgramOptions) => {
  const session = useSession();
  const userId = session?.user?.id;

  return useQuery(
    [QUERIES.ACTIVE_PROGRAM, userId],
    () => fetchActiveProgram(userId!),
    { enabled: !!userId && (options?.enabled ?? true) },
  );
};

const fetchActiveProgram = async (
  userId: string,
): Promise<ActiveProgram | null> => {
  // Prefer the active enrollment; fall back to the most recently completed one
  // so the complete state survives the terminal status flip. Abandoned/paused
  // enrollments never surface here.
  const { data: enrollments, error } = await supabase
    .from('user_programs')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['active', 'completed'])
    .order('completed_at', { ascending: false, nullsFirst: true });

  if (error) throw error;

  const enrollmentRow =
    enrollments?.find((row) => row.status === 'active') ?? enrollments?.[0];
  if (!enrollmentRow) return null;

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
      .select('program_session_id')
      .eq('user_program_id', enrollmentRow.id),
  ]);

  if (programResult.error) throw programResult.error;
  if (sessionsResult.error) throw sessionsResult.error;
  if (completionsResult.error) throw completionsResult.error;

  const enrollment = mapUserProgramRow(enrollmentRow);
  const program = mapProgramRow(programResult.data);
  const sessions = (sessionsResult.data ?? []).map(mapProgramSessionRow);
  const satisfiedIds = new Set(
    (completionsResult.data ?? []).map((row) => row.program_session_id),
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
  };
};
