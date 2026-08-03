import { FunctionsHttpError } from '@supabase/supabase-js';
import { useMutation } from '@tanstack/react-query';

import { supabase } from '../supabaseClient';
import { localDateString } from '~/utils/dateOnly';
import type { RecommendSessionResponse } from '~/types';

/** Stable codes for the failure modes the UI messages differently. */
export type RecommendSessionErrorCode =
  | 'premium_required'
  | 'no_movements'
  | 'recommendation_failed'
  | 'unknown';

export class RecommendSessionError extends Error {
  code: RecommendSessionErrorCode;
  constructor(code: RecommendSessionErrorCode, message: string) {
    super(message);
    this.name = 'RecommendSessionError';
    this.code = code;
  }
}

const recommendSession = async (): Promise<RecommendSessionResponse> => {
  // client_today anchors the recommender's "days since last workout" to the
  // user's local calendar date — the edge function runs in UTC and has no
  // notion of the caller's timezone otherwise. Daily-readiness wiring lands
  // in PROD-151.
  const { data, error } =
    await supabase.functions.invoke<RecommendSessionResponse>(
      'recommend-session',
      { body: { client_today: localDateString() } },
    );

  if (error) {
    // supabase.functions.invoke surfaces non-2xx as a FunctionsHttpError whose
    // body is on `.context` (a Response). Parse it to recover our error codes.
    let code: RecommendSessionErrorCode = 'unknown';
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json();
        if (body?.paywall_trigger || body?.error === 'premium_required') {
          code = 'premium_required';
        } else if (body?.error === 'no_movements') {
          code = 'no_movements';
        } else if (body?.error === 'recommendation_failed') {
          code = 'recommendation_failed';
        }
      } catch {
        /* non-JSON body — leave code as 'unknown' */
      }
    }
    throw new RecommendSessionError(code, error.message);
  }

  if (!data?.recommendation) {
    throw new RecommendSessionError('unknown', 'No recommendation returned');
  }

  return data;
};

/**
 * Calls the recommend-session Edge Function and resolves to a validated
 * recommendation. Premium gating is enforced server-side; the client only
 * invokes this for premium users (free users see a preview modal instead).
 */
export const useRecommendSession = () =>
  useMutation({ mutationFn: recommendSession });
