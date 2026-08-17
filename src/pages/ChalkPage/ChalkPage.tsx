import clsx from 'clsx';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useChalkChat, useChalkMessages } from '~/api';
import { PremiumGate, useBottomNavVisible } from '~/components';
import { Button } from '~/components/ui/button';

import { Composer } from './components/Composer';
import { EmptyState } from './components/EmptyState';
import { MessageList } from './components/MessageList';
import { ThreadMenu } from './components/ThreadMenu';

const ERROR_COPY: Record<string, string> = {
  rate_limited: "You've hit today's message limit. Chalk will be back tomorrow.",
  message_too_long: 'That message is too long — try trimming it down.',
  thread_full: 'This conversation is full. Start a new one to keep going.',
  thread_not_found: 'That conversation isn’t available any more.',
  chalk_failed: 'Chalk couldn’t answer that one. Try again?',
};

const ChalkConversation = () => {
  const navigate = useNavigate();
  const bottomNavVisible = useBottomNavVisible();
  const [threadId, setThreadId] = useState<string | null>(null);

  const { data: messages = [], isLoading } = useChalkMessages(threadId);
  const { send, pendingMessage, lastAttempt, isSending, error, reset } =
    useChalkChat({
      threadId,
      onThreadCreated: setThreadId,
    });

  const handleSend = useCallback(
    (message: string) => {
      reset();
      send(message);
    },
    [reset, send],
  );

  const startNewThread = useCallback(() => {
    setThreadId(null);
    reset();
  }, [reset]);

  const openThread = useCallback(
    (id: string) => {
      setThreadId(id);
      reset();
    },
    [reset],
  );

  // The server gate is authoritative; this catches a trial that lapsed
  // mid-session, when the client-side gate still believes it has access.
  useEffect(() => {
    if (error?.code === 'premium_required') navigate('/paywall');
  }, [error, navigate]);

  const isEmpty = !isLoading && messages.length === 0 && !pendingMessage;

  return (
    // Full-height column: only the message list scrolls, so the composer stays
    // put. Height accounts for the thumb bar exactly when it is on screen —
    // `Root` drops its padding at the same moment the keyboard opens.
    <div
      className={clsx(
        'flex flex-col',
        bottomNavVisible ? 'h-dvh-bottomnav' : 'h-[100dvh]',
      )}
    >
      <header className="flex items-center justify-between border-b border-border px-1.5 py-0.5">
        <span className="text-sm font-semibold">Chalk</span>
        <ThreadMenu
          currentThreadId={threadId}
          onSelectThread={openThread}
          onNewThread={startNewThread}
        />
      </header>

      {isEmpty ? (
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto w-full max-w-md">
            <EmptyState onPick={handleSend} disabled={isSending} />
          </div>
        </div>
      ) : (
        <MessageList
          messages={messages}
          pendingMessage={pendingMessage}
          isSending={isSending}
        />
      )}

      {error && error.code !== 'premium_required' && (
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-1 px-1.5 py-1">
          <p className="text-xs text-destructive">
            {ERROR_COPY[error.code] ?? 'Something went wrong — try again.'}
          </p>
          {lastAttempt && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSend(lastAttempt)}
            >
              Retry
            </Button>
          )}
        </div>
      )}

      <Composer onSend={handleSend} disabled={isSending} />
    </div>
  );
};

export const ChalkPage = () => (
  <PremiumGate featureName="Chalk">
    <ChalkConversation />
  </PremiumGate>
);
