import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { ProgramSession } from '~/types';

import type { Json } from '../../types/supabase';
import { supabase } from '../supabaseClient';
import { mapProgramSessionRow } from './program';
import { useProgramMutationErrorHandler } from './useProgramMutationErrorHandler';

export interface DuplicateProgramSessionInput {
  /** The session to copy. */
  session: ProgramSession;
  /** Where the copy lands (usually the current session count). */
  sequenceIndex: number;
  weekNumber: number;
  dayNumber: number;
}

export interface DuplicateProgramWeekInput {
  programId: string;
  /** The week's sessions to copy, in `sequenceIndex` order. */
  sessions: ProgramSession[];
  /** Week number the copies are assigned to (usually `maxWeek + 1`). */
  newWeekNumber: number;
  /** `sequenceIndex` of the first copy (usually the current session count). */
  startSequenceIndex: number;
}

const sessionInsert = (
  session: ProgramSession,
  sequenceIndex: number,
  weekNumber: number,
  dayNumber: number,
) => ({
  program_id: session.programId,
  sequence_index: sequenceIndex,
  week_number: weekNumber,
  day_number: dayNumber,
  title: session.title,
  workout_options: session.workoutOptions as unknown as Json,
  notes: session.notes,
});

/** Copies a single session, appending it to the end of the program. */
export const useDuplicateProgramSession = () => {
  const queryClient = useQueryClient();
  const onError = useProgramMutationErrorHandler();

  return useMutation({
    mutationFn: async (
      input: DuplicateProgramSessionInput,
    ): Promise<ProgramSession> => {
      const { data, error } = await supabase
        .from('program_sessions')
        .insert(
          sessionInsert(
            input.session,
            input.sequenceIndex,
            input.weekNumber,
            input.dayNumber,
          ),
        )
        .select('*')
        .single();

      if (error) throw error;
      return mapProgramSessionRow(data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QUERIES.PROGRAM, variables.session.programId],
      });
    },
    onError,
  });
};

/**
 * Copies every session in a week as a new week appended to the program, keeping
 * each session's `dayNumber`. Makes hand-building a repetitive program (like
 * DFW's five near-identical weeks) a fast operation.
 */
export const useDuplicateProgramWeek = () => {
  const queryClient = useQueryClient();
  const onError = useProgramMutationErrorHandler();

  return useMutation({
    mutationFn: async (
      input: DuplicateProgramWeekInput,
    ): Promise<ProgramSession[]> => {
      const rows = input.sessions.map((session, i) =>
        sessionInsert(
          session,
          input.startSequenceIndex + i,
          input.newWeekNumber,
          session.dayNumber,
        ),
      );

      const { data, error } = await supabase
        .from('program_sessions')
        .insert(rows)
        .select('*');

      if (error) throw error;
      return (data ?? []).map(mapProgramSessionRow);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERIES.PROGRAM, variables.programId] });
    },
    onError,
  });
};
