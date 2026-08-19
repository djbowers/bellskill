import { supabase } from '~/supabaseClient';

/**
 * Fire-and-forget: ask chalk-embed-history to (re-)embed one workout for
 * Chalk's history retrieval (PROD-248). Called after a workout is logged and
 * after post-workout notes are saved — the function upserts idempotently, so
 * a notes edit just refreshes the chunk. Embedding is an enhancement to a
 * future chat, never part of saving a workout, so failures only log.
 */
export const embedWorkoutHistory = (workoutLogId: number): void => {
  void supabase.functions
    .invoke('chalk-embed-history', {
      body: { workout_log_id: workoutLogId },
    })
    .then(({ error }) => {
      if (error) console.error('chalk-embed-history failed:', error);
    });
};

/** 200 workouts per server page × 20 pages bounds one mount's work at 4000
 *  workouts — far beyond any real history, while a server-side accounting bug
 *  can never turn this into an unthrottled infinite loop. */
const MAX_BACKFILL_PAGES = 20;

/**
 * Fire-and-forget backfill of the lifter's pre-RAG history, triggered once
 * from ChalkPage. The function pages and reports `remaining`; recurse only
 * while the server is demonstrably making progress.
 */
export const backfillWorkoutHistory = (attempt = 0): void => {
  if (attempt >= MAX_BACKFILL_PAGES) {
    console.error('chalk-embed-history backfill: page cap reached, stopping');
    return;
  }
  void supabase.functions
    .invoke<{ embedded: number; remaining: number }>('chalk-embed-history', {
      body: { backfill: true },
    })
    .then(({ data, error }) => {
      if (error) {
        console.error('chalk-embed-history backfill failed:', error);
        return;
      }
      if ((data?.remaining ?? 0) > 0 && (data?.embedded ?? 0) > 0) {
        backfillWorkoutHistory(attempt + 1);
      }
    });
};
