import { useMutation, useQueryClient } from 'react-query';

import { QUERIES } from '~/constants';
import { ProgramSession, WorkoutOptions } from '~/types';

import type { Json } from '../../types/supabase';
import { supabase } from '../supabaseClient';
import { mapProgramSessionRow } from './program';
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
          workout_options: input.workoutOptions as unknown as Json,
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        })
        .eq('id', input.sessionId)
        .select('*')
        .single();

      if (error) throw error;
      return mapProgramSessionRow(data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries([QUERIES.PROGRAM, variables.programId]);
      queryClient.invalidateQueries([QUERIES.PROGRAMS]);
      queryClient.invalidateQueries([QUERIES.ACTIVE_PROGRAM]);
      queryClient.invalidateQueries([QUERIES.PROGRAM_PROGRESS]);
    },
    onError,
  });
};
