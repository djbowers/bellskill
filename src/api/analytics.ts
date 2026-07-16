import { supabase } from '~/supabaseClient';

import type { Json } from '../../types/supabase';

/**
 * Activation funnel events (PROD-157). `signup_completed` is emitted
 * server-side by the handle_new_user() trigger; the rest are emitted from the
 * client via {@link trackEvent}.
 */
export enum AnalyticsEvent {
  SignupCompleted = 'signup_completed',
  FirstSessionStarted = 'first_session_started',
  WorkoutStarted = 'workout_started',
  WorkoutCompleted = 'workout_completed',
  // Launchpad shell exposure (PROD-171): records the sticky shell variant, the
  // user's population (new/returning), and the content shown, so the launchpad
  // A/B is joinable to the funnel events above by `user_id`.
  LaunchpadExposed = 'launchpad_exposed',
  // AI Next Session Recommender (PROD-89).
  RecommendationRequested = 'recommendation_requested',
  RecommendationAccepted = 'recommendation_accepted',
  RecommendationRegenerated = 'recommendation_regenerated',
  RecommendationPreviewShown = 'recommendation_preview_shown',
}

interface TrackEventParams {
  event: AnalyticsEvent;
  userId: string;
  properties?: Record<string, Json>;
}

/**
 * Append a funnel event to `analytics_events`. Fire-and-forget: analytics must
 * never break a user flow, so this swallows (and logs) every error and never
 * throws. Callers may `void trackEvent(...)` without awaiting.
 */
export async function trackEvent({
  event,
  userId,
  properties = {},
}: TrackEventParams): Promise<void> {
  if (!userId) return;

  try {
    const { error } = await supabase
      .from('analytics_events')
      .insert({ user_id: userId, event_name: event, properties });

    if (error) {
      console.error(`[analytics] failed to track ${event}`, error);
    }
  } catch (err) {
    console.error(`[analytics] unexpected error tracking ${event}`, err);
  }
}
