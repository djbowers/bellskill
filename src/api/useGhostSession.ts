import { useQuery } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { GhostSession } from '~/types';

import { supabase } from '../supabaseClient';

/**
 * The previous run of the workout in progress, to pace against.
 *
 * Two ways in, matching the two ways a workout gets repeated:
 *
 * - **Repeat from history** already knows the log it copied, carried on the
 *   options as `previousWorkoutLogId`. Straight lookup.
 * - **Program session** resolves through `get_ghost_workout_log`, which matches
 *   on clone lineage and sequence position rather than on the session id or the
 *   composed title — both of which change under renames, re-enrollment, or an
 *   auto-repeat loop. See the RPC's own notes.
 *
 * Returns null rather than throwing when there is nothing to race: a
 * first-ever run of a workout is the normal case, not an error.
 */
export const useGhostSession = ({
  previousWorkoutLogId,
  programSessionId,
  enabled = true,
}: {
  previousWorkoutLogId?: number;
  programSessionId?: string | null;
  enabled?: boolean;
}) =>
  useQuery({
    queryKey: [QUERIES.GHOST_SESSION, previousWorkoutLogId, programSessionId],
    enabled:
      enabled && (previousWorkoutLogId != null || programSessionId != null),
    // A finished workout never changes, so the ghost is stable for the session.
    staleTime: Infinity,
    queryFn: () =>
      fetchGhostSession({ previousWorkoutLogId, programSessionId }),
  });

const fetchGhostSession = async ({
  previousWorkoutLogId,
  programSessionId,
}: {
  previousWorkoutLogId?: number;
  programSessionId?: string | null;
}): Promise<GhostSession | null> => {
  const log = previousWorkoutLogId
    ? await fetchLogById(previousWorkoutLogId)
    : programSessionId
      ? await fetchLogByProgramSession(programSessionId)
      : null;

  if (!log) return null;

  const { data: splitRows, error } = await supabase
    .from('workout_round_splits')
    .select('round_index, elapsed_ms')
    .eq('workout_log_id', log.id)
    .order('round_index');

  // A log from before splits were recorded has none, which is expected — the
  // ghost falls back to a pace derived from its duration. A genuine query
  // failure lands in the same place: a coarser ghost beats no ghost.
  if (error) console.error(error);

  return {
    workoutLogId: log.id,
    completedAt: new Date(log.completed_at),
    totalRounds: log.completed_rounds ?? 0,
    totalDurationMs:
      new Date(log.completed_at).getTime() - new Date(log.started_at).getTime(),
    splits: (splitRows ?? []).map((row) => ({
      roundIndex: row.round_index,
      elapsedMs: row.elapsed_ms,
    })),
  };
};

const GHOST_LOG_COLUMNS = 'id, started_at, completed_at, completed_rounds';

const fetchLogById = async (workoutLogId: number) => {
  const { data, error } = await supabase
    .from('workout_logs')
    .select(GHOST_LOG_COLUMNS)
    .eq('id', workoutLogId)
    .maybeSingle();

  if (error) {
    console.error(error);
    return null;
  }
  return data;
};

const fetchLogByProgramSession = async (programSessionId: string) => {
  const { data, error } = await supabase
    .rpc('get_ghost_workout_log', {
      p_program_session_id: programSessionId,
    })
    .select(GHOST_LOG_COLUMNS)
    .maybeSingle();

  if (error) {
    console.error(error);
    return null;
  }
  return data;
};
