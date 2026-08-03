import { FunctionsHttpError } from '@supabase/supabase-js';
import { useMutation } from '@tanstack/react-query';

import { supabase } from '../supabaseClient';
import type { RecommendProgramResponse } from '~/types';

/** Stable codes for the failure modes the UI messages differently. */
export type RecommendProgramErrorCode =
  | 'premium_required'
  | 'no_candidates'
  | 'recommendation_failed'
  | 'unknown';

export class RecommendProgramError extends Error {
  code: RecommendProgramErrorCode;
  constructor(code: RecommendProgramErrorCode, message: string) {
    super(message);
    this.name = 'RecommendProgramError';
    this.code = code;
  }
}

const recommendProgram = async (): Promise<RecommendProgramResponse> => {
  const { data, error } =
    await supabase.functions.invoke<RecommendProgramResponse>(
      'recommend-program',
      { body: {} },
    );

  if (error) {
    // supabase.functions.invoke surfaces non-2xx as a FunctionsHttpError whose
    // body is on `.context` (a Response). Parse it to recover our error codes.
    let code: RecommendProgramErrorCode = 'unknown';
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json();
        if (body?.paywall_trigger || body?.error === 'premium_required') {
          code = 'premium_required';
        } else if (body?.error === 'no_candidates') {
          code = 'no_candidates';
        } else if (body?.error === 'recommendation_failed') {
          code = 'recommendation_failed';
        }
      } catch {
        /* non-JSON body — leave code as 'unknown' */
      }
    }
    throw new RecommendProgramError(code, error.message);
  }

  if (!data?.recommendation) {
    throw new RecommendProgramError('unknown', 'No recommendation returned');
  }

  return data;
};

/**
 * Calls the recommend-program Edge Function and resolves to a validated
 * program recommendation (one program + concurrent-vs-queue mode). Premium
 * gating is enforced server-side; the client only invokes this for premium
 * users (free users see a preview instead).
 */
export const useRecommendProgram = () =>
  useMutation({ mutationFn: recommendProgram });
