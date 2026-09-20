import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { SessionLayoutEntry } from '~/types';

import { supabase } from '../supabaseClient';
import { ProgramWithSessions } from './useProgram';
import { useProgramMutationErrorHandler } from './useProgramMutationErrorHandler';

export interface SetProgramSessionLayoutInput {
  programId: string;
  /**
   * Every session of the program with its target week/day. Weeks must run
   * 1..W and days 1..D within each week; the RPC ranks `sequence_index` by
   * (week, day).
   */
  layout: SessionLayoutEntry[];
}

const applyLayout = (
  data: ProgramWithSessions,
  layout: SessionLayoutEntry[],
): ProgramWithSessions => {
  const byId = new Map(layout.map((entry) => [entry.id, entry]));
  const sessions = data.sessions
    .map((session) => {
      const entry = byId.get(session.id);
      return entry
        ? {
            ...session,
            weekNumber: entry.weekNumber,
            dayNumber: entry.dayNumber,
          }
        : session;
    })
    .sort((a, b) => a.weekNumber - b.weekNumber || a.dayNumber - b.dayNumber)
    .map((session, sequenceIndex) => ({ ...session, sequenceIndex }));
  return { ...data, sessions };
};

/**
 * Writes an explicit week/day for every session of an owned program via the
 * `set_program_session_layout` RPC — the persistence step behind drag-and-drop
 * and week moves. The reindex runs server-side in one transaction because
 * `UNIQUE (program_id, sequence_index)` is NOT deferrable. The cached program
 * is updated optimistically so a drop settles in place; a failure rolls it
 * back and toasts.
 */
export const useSetProgramSessionLayout = () => {
  const queryClient = useQueryClient();
  const onError = useProgramMutationErrorHandler();

  return useMutation({
    mutationFn: async (input: SetProgramSessionLayoutInput): Promise<void> => {
      const { error } = await supabase.rpc('set_program_session_layout', {
        p_program_id: input.programId,
        p_layout: input.layout.map((entry) => ({
          id: entry.id,
          week_number: entry.weekNumber,
          day_number: entry.dayNumber,
        })),
      });
      if (error) throw error;
    },
    onMutate: async (input) => {
      const queryKey = [QUERIES.PROGRAM, input.programId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ProgramWithSessions>(queryKey);
      if (previous) {
        queryClient.setQueryData(queryKey, applyLayout(previous, input.layout));
      }
      return { previous };
    },
    onError: (error, input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          [QUERIES.PROGRAM, input.programId],
          context.previous,
        );
      }
      onError(error);
    },
    onSettled: (_data, _error, input) => {
      queryClient.invalidateQueries({
        queryKey: [QUERIES.PROGRAM, input.programId],
      });
      queryClient.invalidateQueries({ queryKey: [QUERIES.PROGRAMS] });
      queryClient.invalidateQueries({ queryKey: [QUERIES.ACTIVE_PROGRAM] });
      queryClient.invalidateQueries({ queryKey: [QUERIES.PROGRAM_PROGRESS] });
    },
  });
};
