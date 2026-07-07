import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { AnalyticsEvent, trackEvent } from '~/api';
import {
  PendingProgramSession,
  useProgramSession,
  useSession,
  useWorkoutOptions,
} from '~/contexts';
import { WorkoutOptions } from '~/types';

import type { Json } from '../../types/supabase';

/** Where a workout start originated, for activation-funnel attribution. */
export type WorkoutStartSource =
  | 'builder'
  | 'curated'
  | 'history_repeat'
  | 'recommender'
  | 'program';

/**
 * Shared "start a workout" action used by the manual builder, curated
 * templates, history repeats, and program sessions. Stamps `startedAt`, commits
 * the options to context, fires the `workout_started` analytics event (tagged
 * with `source`), and routes into the active workout.
 *
 * For a program start (`source === 'program'`) the caller passes `programSession`
 * so the log step can advance the program on completion; every other start
 * passes `null`, which clears any stale pending session from a prior start.
 */
export const useStartWorkout = () => {
  const navigate = useNavigate();
  const [, updateWorkoutOptions] = useWorkoutOptions();
  const [, setProgramSession] = useProgramSession();
  const session = useSession();
  const userId = session?.user?.id;

  return useCallback(
    (
      options: Omit<WorkoutOptions, 'startedAt'>,
      source: WorkoutStartSource,
      extraProps: Record<string, Json> = {},
      programSession: PendingProgramSession | null = null,
    ) => {
      updateWorkoutOptions({ ...options, startedAt: new Date() });
      setProgramSession(programSession);

      if (userId) {
        void trackEvent({
          event: AnalyticsEvent.WorkoutStarted,
          userId,
          properties: { source, ...extraProps },
        });
      }

      navigate('active');
    },
    [navigate, updateWorkoutOptions, setProgramSession, userId],
  );
};
