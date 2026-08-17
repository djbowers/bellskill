import { FunctionsHttpError } from '@supabase/supabase-js';

import { localDateString } from '~/utils/dateOnly';
import type { ChalkChatResponse } from '~/types';

import { supabase } from '../supabaseClient';

/**
 * The transport for one Chalk turn.
 *
 * Deliberately the only module that knows how the reply reaches the client.
 * Today that is a single JSON response via functions.invoke; when the streamed
 * SSE path lands it replaces the body of `sendChalkMessage` and nothing above
 * it changes shape — the hook already treats a turn as "text that arrives".
 */

/** Stable codes for the failure modes the UI messages differently. */
export type ChalkChatErrorCode =
  | 'premium_required'
  | 'rate_limited'
  | 'thread_not_found'
  | 'thread_full'
  | 'message_too_long'
  | 'empty_message'
  | 'chalk_failed'
  | 'unknown';

export class ChalkChatError extends Error {
  code: ChalkChatErrorCode;
  /**
   * Set when the turn failed *after* the thread was created and the user's
   * message stored. The caller must adopt it, or a retry opens a second thread
   * and the conversation splits in two.
   */
  threadId: string | null;

  constructor(
    code: ChalkChatErrorCode,
    message: string,
    threadId: string | null = null,
  ) {
    super(message);
    this.name = 'ChalkChatError';
    this.code = code;
    this.threadId = threadId;
  }
}

/** Every error code the function can return, so the mapping stays exhaustive. */
const KNOWN_CODES: ChalkChatErrorCode[] = [
  'premium_required',
  'rate_limited',
  'thread_not_found',
  'thread_full',
  'message_too_long',
  'empty_message',
  'chalk_failed',
];

export interface SendChalkMessageArgs {
  message: string;
  /** Omitted for the first turn — the function creates the thread. */
  threadId?: string | null;
}

export const sendChalkMessage = async ({
  message,
  threadId,
}: SendChalkMessageArgs): Promise<ChalkChatResponse> => {
  // client_today anchors "days since last workout" to the caller's local
  // calendar date — the Edge Function runs in UTC with no notion of it.
  const { data, error } = await supabase.functions.invoke<ChalkChatResponse>(
    'chalk-chat',
    {
      body: {
        message,
        thread_id: threadId ?? null,
        client_today: localDateString(),
      },
    },
  );

  if (error) {
    // functions.invoke surfaces non-2xx as a FunctionsHttpError whose body is
    // on `.context` (a Response). Parse it to recover our error codes.
    let code: ChalkChatErrorCode = 'unknown';
    let failedThreadId: string | null = null;
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json();
        if (body?.paywall_trigger) {
          code = 'premium_required';
        } else if (KNOWN_CODES.includes(body?.error)) {
          code = body.error;
        }
        if (typeof body?.thread_id === 'string') failedThreadId = body.thread_id;
      } catch {
        /* non-JSON body — leave code as 'unknown' */
      }
    }
    throw new ChalkChatError(code, error.message, failedThreadId);
  }

  if (!data?.reply) {
    throw new ChalkChatError('unknown', 'No reply returned');
  }

  return data;
};
