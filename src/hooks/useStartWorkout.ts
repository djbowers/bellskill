import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { AnalyticsEvent, trackEvent } from '~/api';
import { useSession, useWorkoutOptions } from '~/contexts';
import { WorkoutOptions } from '~/types';

import type { Json } from '../../types/supabase';

/** Where a workout start originated, for activation-funnel attribution. */
export type WorkoutStartSource =
  | 'builder'
  | 'curated'
  | 'history_repeat'
  | 'recommender';

/**
 * Shared "start a workout" action used by the manual builder, curated
 * templates, and history repeats. Stamps `startedAt`, commits the options to
 * context, fires the `workout_started` analytics event (tagged with `source`),
 * and routes into the active workout.
 */
export const useStartWorkout = () => {
  const navigate = useNavigate();
  const [, updateWorkoutOptions] = useWorkoutOptions();
  const session = useSession();
  const userId = session?.user?.id;

  return useCallback(
    (
      options: Omit<WorkoutOptions, 'startedAt'>,
      source: WorkoutStartSource,
      extraProps: Record<string, Json> = {},
    ) => {
      updateWorkoutOptions({ ...options, startedAt: new Date() });

      if (userId) {
        void trackEvent({
          event: AnalyticsEvent.WorkoutStarted,
          userId,
          properties: { source, ...extraProps },
        });
      }

      navigate('active');
    },
    [navigate, updateWorkoutOptions, userId],
  );
};
