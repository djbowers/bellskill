import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { WorkoutOptions } from '~/types';
import { fromWorkoutMode } from '~/utils';

import type { Json } from '../../types/supabase';
import { supabase } from '../supabaseClient';
import { serializeSessionWorkoutOptions } from './program';
import { useProgramMutationErrorHandler } from './useProgramMutationErrorHandler';

export interface UpdateProgramSessionsForwardInput {
  sessionId: string;
  /** The owning program — used to invalidate its cached fetch on success. */
  programId: string;
  title: string;
  workoutOptions: Omit<WorkoutOptions, 'startedAt'>;
}

/**
 * "This and all future sessions": rewrites the edited session in full (same as
 * useUpdateProgramSession), then propagates only its movement prescription —
 * movements, shared weights, workout mode — onto every later not-yet-completed
 * session via the `update_program_sessions_forward` RPC. Each later session
 * keeps its own title, notes, goal, duration, and rest settings.
 *
 * Returns the number of later sessions rewritten.
 */
export const useUpdateProgramSessionsForward = () => {
  const queryClient = useQueryClient();
  const onError = useProgramMutationErrorHandler();

  return useMutation({
    mutationFn: async (
      input: UpdateProgramSessionsForwardInput,
    ): Promise<number> => {
      const { error: updateError } = await supabase
        .from('program_sessions')
        .update({
          title: input.title,
          workout_options: serializeSessionWorkoutOptions(input.workoutOptions),
        })
        .eq('id', input.sessionId);
      if (updateError) throw updateError;

      const { movements, ...options } = input.workoutOptions;
      const forwardOptions = {
        movements,
        sharedWeightOneValue: options.sharedWeightOneValue,
        sharedWeightOneUnit: options.sharedWeightOneUnit,
        sharedWeightTwoValue: options.sharedWeightTwoValue,
        sharedWeightTwoUnit: options.sharedWeightTwoUnit,
        ...fromWorkoutMode(options.workoutMode),
      };

      const { data, error } = await supabase.rpc(
        'update_program_sessions_forward',
        {
          p_session_id: input.sessionId,
          // Cast: the generated RPC arg is `Json`, which a typed interface
          // can't satisfy structurally (no index signature). The shape is
          // asserted by the forward-apply e2e cases.
          p_forward_options: forwardOptions as unknown as Json,
        },
      );
      if (error) throw error;
      return data as number;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [QUERIES.PROGRAM, variables.programId],
      });
      queryClient.invalidateQueries({ queryKey: [QUERIES.PROGRAMS] });
      queryClient.invalidateQueries({ queryKey: [QUERIES.ACTIVE_PROGRAM] });
      queryClient.invalidateQueries({ queryKey: [QUERIES.PROGRAM_PROGRESS] });
    },
    onError,
  });
};
