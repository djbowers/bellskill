import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { ProgramSession, WorkoutOptions } from '~/types';

import { supabase } from '../supabaseClient';
import {
  mapProgramSessionRow,
  serializeSessionWorkoutOptions,
} from './program';
import { useProgramMutationErrorHandler } from './useProgramMutationErrorHandler';

export interface UpdateProgramSessionInput {
  sessionId: string;
  /** The owning program — used to invalidate its cached fetch on success. */
  programId: string;
  title: string;
  workoutOptions: Omit<WorkoutOptions, 'startedAt'>;
  notes?: string | null;
}

/**
 * Edits an existing session of an owned program: rewrites its title +
 * `workout_options` (the builder's shape, stored verbatim) in place. Sequence,
 * week/day, and completions are untouched — the session id is stable, so any
 * `program_session_completions` row keeps pointing at it. RLS keeps the update
 * owner-only ("... update sessions of own programs").
 */
export const useUpdateProgramSession = () => {
  const queryClient = useQueryClient();
  const onError = useProgramMutationErrorHandler();

  return useMutation({
    mutationFn: async (
      input: UpdateProgramSessionInput,
    ): Promise<ProgramSession> => {
      const { data, error } = await supabase
        .from('program_sessions')
        .update({
          title: input.title,
          workout_options: serializeSessionWorkoutOptions(input.workoutOptions),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        })
        .eq('id', input.sessionId)
        .select('*')
        .single();

      if (error) throw error;
      return mapProgramSessionRow(data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERIES.PROGRAM, variables.programId] });
      queryClient.invalidateQueries({ queryKey: [QUERIES.PROGRAMS] });
      queryClient.invalidateQueries({ queryKey: [QUERIES.ACTIVE_PROGRAM] });
      queryClient.invalidateQueries({ queryKey: [QUERIES.PROGRAM_PROGRESS] });
    },
    onError,
  });
};
