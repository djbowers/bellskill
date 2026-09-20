import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { ProgramSession, WorkoutOptions } from '~/types';

import { supabase } from '../supabaseClient';
import {
  compactProgramSessions,
  mapProgramSessionRow,
  serializeSessionWorkoutOptions,
} from './program';
import { useProgramMutationErrorHandler } from './useProgramMutationErrorHandler';

export interface SaveProgramSessionInput {
  programId: string;
  sequenceIndex: number;
  weekNumber: number;
  dayNumber: number;
  title: string;
  workoutOptions: Omit<WorkoutOptions, 'startedAt'>;
  notes?: string | null;
}

/**
 * Persists the builder's current options as a new `program_sessions` row — the
 * "Save session" counterpart to starting a workout (`loadIntoBuilder` in
 * reverse). The row is appended at `sequenceIndex` (the current session count)
 * with its target week/day, then the program is compacted so the session ranks
 * where its week/day says it belongs.
 */
export const useSaveProgramSession = () => {
  const queryClient = useQueryClient();
  const onError = useProgramMutationErrorHandler();

  return useMutation({
    mutationFn: async (
      input: SaveProgramSessionInput,
    ): Promise<ProgramSession> => {
      const { data, error } = await supabase
        .from('program_sessions')
        .insert({
          program_id: input.programId,
          sequence_index: input.sequenceIndex,
          week_number: input.weekNumber,
          day_number: input.dayNumber,
          title: input.title,
          workout_options: serializeSessionWorkoutOptions(input.workoutOptions),
          notes: input.notes ?? null,
        })
        .select('*')
        .single();

      if (error) throw error;
      await compactProgramSessions(input.programId);
      return mapProgramSessionRow(data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERIES.PROGRAM, variables.programId] });
      queryClient.invalidateQueries({ queryKey: [QUERIES.PROGRAMS] });
    },
    onError,
  });
};
