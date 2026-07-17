import { useQuery } from 'react-query';

import { QUERIES } from '~/constants';
import { useSession } from '~/contexts';
import { Program, ProgramSession, UserProgram } from '~/types';

import { supabase } from '../supabaseClient';
import {
  mapProgramRow,
  mapProgramSessionCompletionRow,
  mapProgramSessionRow,
  mapUserProgramRow,
} from './program';

/** Per-session progress state within an enrollment. */
export type SessionState = 'done' | 'skipped' | 'upcoming';

export interface SessionProgress {
  session: ProgramSession;
  state: SessionState;
  /**
   * The logged `workout_logs.id` for a `done` session — the link target for the
   * history view. `null` for skipped or upcoming sessions.
   */
  workoutLogId: number | null;
}

export interface WeekProgress {
  weekNumber: number;
  sessions: SessionProgress[];
}

export interface ProgramProgressResult {
  program: Program;
  /**
   * The user's enrollment in this program, or `null` when they have never
   * enrolled (every session then reads as `upcoming`).
   */
  enrollment: UserProgram | null;
  /** Sessions grouped by week, each in program order. */
  weeks: WeekProgress[];
  /** Satisfied sessions (done + skipped) — the "N" in "N of M". */
  completedCount: number;
  /** Total sessions in the program — the "M" in "N of M". */
  totalCount: number;
  /** 1-based week of the next unsatisfied session, or the last week once complete. */
  currentWeek: number;
  /** Total weeks in the program — the "Y" in "Week X of Y". */
  totalWeeks: number;
  /** True once every session has a completion (or the enrollment is completed). */
  isComplete: boolean;
}

interface UseProgramProgressOptions {
  /**
   * Gate the query. Defaults to enabled — pass `false` (e.g. behind the
   * `programs` flag) so non-program builds fire zero extra requests.
   */
  enabled?: boolean;
}

/**
 * Progress for a single program: its sessions grouped by week, each tagged
 * done / skipped / upcoming, plus the counts that drive the "N of M sessions"
 * and "Week X of Y" summary. Progress is derived **entirely** from the
 * `program_session_completions` set for the user's enrollment joined to
 * `program_sessions` — nothing is duplicated from `workout_logs`. Completed
 * sessions carry their `workoutLogId` so the page can link each into
 * `/history/<id>`.
 *
 * `programId` is a program row id (the user's own clone, as listed in
 * `ProgramsPage`). The matching enrollment is resolved as the active one, or —
 * failing that — the most recent, mirroring {@link useActiveProgram}.
 */
export const useProgramProgress = (
  programId?: string,
  options?: UseProgramProgressOptions,
) => {
  const session = useSession();
  const userId = session?.user?.id;

  return useQuery(
    [QUERIES.PROGRAM_PROGRESS, programId, userId],
    () => fetchProgramProgress(programId!, userId!),
    { enabled: !!programId && !!userId && (options?.enabled ?? true) },
  );
};

const fetchProgramProgress = async (
  programId: string,
  userId: string,
): Promise<ProgramProgressResult> => {
  const [programResult, sessionsResult, enrollmentsResult] = await Promise.all([
    supabase.from('programs').select('*').eq('id', programId).single(),
    supabase
      .from('program_sessions')
      .select('*')
      .eq('program_id', programId)
      .order('sequence_index', { ascending: true }),
    // The user's enrollments in this program. Prefer the active one; fall back
    // to the most recently completed/abandoned so progress still renders after
    // the terminal status flip.
    supabase
      .from('user_programs')
      .select('*')
      .eq('user_id', userId)
      .eq('program_id', programId)
      .order('completed_at', { ascending: false, nullsFirst: false }),
  ]);

  if (programResult.error) throw programResult.error;
  if (sessionsResult.error) throw sessionsResult.error;
  if (enrollmentsResult.error) throw enrollmentsResult.error;

  const program = mapProgramRow(programResult.data);
  const sessions = (sessionsResult.data ?? []).map(mapProgramSessionRow);

  const enrollmentRow =
    enrollmentsResult.data?.find((row) => row.status === 'active') ??
    enrollmentsResult.data?.[0] ??
    null;
  const enrollment = enrollmentRow ? mapUserProgramRow(enrollmentRow) : null;

  // Completions only exist once enrolled; skip the fetch otherwise.
  const completions = enrollmentRow
    ? await fetchCompletions(enrollmentRow.id)
    : [];
  const completionBySessionId = new Map(
    completions.map((c) => [c.programSessionId, c]),
  );

  const sessionProgress: SessionProgress[] = sessions.map((s) => {
    const completion = completionBySessionId.get(s.id);
    const state: SessionState = completion
      ? completion.status === 'skipped'
        ? 'skipped'
        : 'done'
      : 'upcoming';
    return {
      session: s,
      state,
      workoutLogId: state === 'done' ? completion!.workoutLogId : null,
    };
  });

  const weeks = groupByWeek(sessionProgress);

  const completedCount = sessionProgress.filter(
    (s) => s.state !== 'upcoming',
  ).length;
  const totalCount = sessions.length;
  const nextUpcoming = sessionProgress.find((s) => s.state === 'upcoming');
  const currentWeek =
    nextUpcoming?.session.weekNumber ??
    sessions[sessions.length - 1]?.weekNumber ??
    0;
  const totalWeeks = Math.max(
    program.numWeeks ?? 0,
    ...sessions.map((s) => s.weekNumber),
    0,
  );
  const isComplete =
    enrollment?.status === 'completed' ||
    (totalCount > 0 && completedCount === totalCount);

  return {
    program,
    enrollment,
    weeks,
    completedCount,
    totalCount,
    currentWeek,
    totalWeeks,
    isComplete,
  };
};

const fetchCompletions = async (userProgramId: string) => {
  const { data, error } = await supabase
    .from('program_session_completions')
    .select('*')
    .eq('user_program_id', userProgramId);

  if (error) throw error;
  return (data ?? []).map(mapProgramSessionCompletionRow);
};

/** Group progress rows into ordered weeks, preserving session order. */
const groupByWeek = (sessions: SessionProgress[]): WeekProgress[] => {
  const groups: WeekProgress[] = [];
  for (const item of sessions) {
    const week = item.session.weekNumber;
    const group = groups.find((g) => g.weekNumber === week);
    if (group) group.sessions.push(item);
    else groups.push({ weekNumber: week, sessions: [item] });
  }
  return groups;
};
