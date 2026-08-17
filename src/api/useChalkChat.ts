import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { QUERIES } from '~/constants';

import { ChalkChatError, sendChalkMessage } from './chalkChat';

interface UseChalkChatArgs {
  threadId: string | null;
  /** Called with the server-assigned id once a thread exists. */
  onThreadCreated?: (threadId: string) => void;
}

export interface UseChalkChat {
  send: (message: string) => void;
  /**
   * The user's turn while the server has NOT yet stored it. Cleared as soon as
   * a persisted row exists, so the bubble is never rendered twice.
   */
  pendingMessage: string | null;
  /** The text of the last send, kept so a failed turn can be retried. */
  lastAttempt: string | null;
  isSending: boolean;
  error: ChalkChatError | null;
  reset: () => void;
}

/**
 * Drives one Chalk turn.
 *
 * The optimistic bubble lives here rather than in react-query's cache because
 * the persisted rows are the source of truth. The handoff is the subtle part:
 * the function stores the user message *before* calling the model, so even a
 * failed turn leaves a real row — at which point the optimistic copy has to go
 * or the lifter sees their question twice.
 */
export const useChalkChat = ({
  threadId,
  onThreadCreated,
}: UseChalkChatArgs): UseChalkChat => {
  const queryClient = useQueryClient();
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [lastAttempt, setLastAttempt] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: sendChalkMessage,
    onSuccess: async (data) => {
      if (!threadId) onThreadCreated?.(data.thread_id);

      await queryClient.invalidateQueries({
        queryKey: [QUERIES.CHALK_MESSAGES, data.thread_id],
      });
      queryClient.invalidateQueries({ queryKey: [QUERIES.CHALK_THREADS] });

      setPendingMessage(null);
    },
    onError: (err: ChalkChatError) => {
      // A thread id on the error means the turn got far enough to persist the
      // user message. Adopt the thread — otherwise a retry opens a second one
      // and splits the conversation — and drop the optimistic copy, since the
      // persisted row now renders that text.
      if (err?.threadId) {
        if (!threadId) onThreadCreated?.(err.threadId);
        setPendingMessage(null);
        queryClient.invalidateQueries({
          queryKey: [QUERIES.CHALK_MESSAGES, err.threadId],
        });
        return;
      }
      // Nothing was persisted (rate limit, validation, network), so the bubble
      // stays put and the lifter's text is still on screen.
    },
  });

  const send = useCallback(
    (message: string) => {
      const trimmed = message.trim();
      if (!trimmed || mutation.isPending) return;
      setPendingMessage(trimmed);
      setLastAttempt(trimmed);
      mutation.mutate({ message: trimmed, threadId });
    },
    [mutation, threadId],
  );

  const reset = useCallback(() => {
    setPendingMessage(null);
    mutation.reset();
  }, [mutation]);

  return {
    send,
    pendingMessage,
    lastAttempt,
    isSending: mutation.isPending,
    error: (mutation.error as ChalkChatError) ?? null,
    reset,
  };
};
