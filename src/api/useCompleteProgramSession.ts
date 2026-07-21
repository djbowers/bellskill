import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { ProgramSessionCompletionStatus } from '~/types';

import { supabase } from '../supabaseClient';

export interface CompleteProgramSessionInput {
  userProgramId: string;
  programSessionId: string;
  /** The real `workout_logs.id` for a completed session; omit/undefined for a skip. */
  workoutLogId?: number | null;
  /** `'completed'` (default) records a done session; `'skipped'` advances the cursor. */
  status?: ProgramSessionCompletionStatus;
}

/**
 * Advances the active program by one session via the Slice-3
 * `complete_program_session` RPC: records a completion (or a skip) and, when it
 * satisfies the final session, flips the enrollment to `completed` — all atomic
 * inside the function. Resolves to `true` when the whole program is now done.
 *
 * `useLogWorkout` calls {@link completeProgramSession} directly in its
 * `onSuccess` (the completed path); this hook drives the card's explicit "Skip".
 */
export const completeProgramSession = async ({
  userProgramId,
  programSessionId,
  workoutLogId = null,
  status = 'completed',
}: CompleteProgramSessionInput): Promise<boolean> => {
  const { data, error } = await supabase.rpc('complete_program_session', {
    p_user_program_id: userProgramId,
    p_program_session_id: programSessionId,
    // Omit for a skip so the function's NULL default applies (the generated arg
    // type is non-nullable `number | undefined`).
    p_workout_log_id: workoutLogId ?? undefined,
    p_status: status,
  });

  if (error) throw error;
  return Boolean(data);
};

export const useCompleteProgramSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: completeProgramSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERIES.ACTIVE_PROGRAM] });
    },
  });
};
