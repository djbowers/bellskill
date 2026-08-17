import clsx from 'clsx';

import type { ChalkMessage } from '~/types';

import { MarkdownLite } from './MarkdownLite';

interface MessageBubbleProps {
  role: ChalkMessage['role'];
  content: string;
  status?: ChalkMessage['status'];
  /** Renders the bubble as not-yet-persisted (the optimistic user turn). */
  pending?: boolean;
}

export const MessageBubble = ({
  role,
  content,
  status = 'complete',
  pending = false,
}: MessageBubbleProps) => {
  const isUser = role === 'user';

  // An errored assistant turn with no text has nothing to show — the page
  // renders its own retry affordance instead.
  if (!isUser && !content.trim()) return null;

  return (
    <div
      className={clsx('flex w-full', isUser ? 'justify-end' : 'justify-start')}
    >
      <div
        className={clsx(
          'max-w-[85%] rounded-md px-1.5 py-1 text-sm',
          isUser
            ? 'bg-primary/10 text-foreground'
            : 'bg-muted text-foreground',
          pending && 'opacity-60',
        )}
        data-testid={isUser ? 'chalk-user-message' : 'chalk-assistant-message'}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="flex flex-col gap-1">
            <MarkdownLite content={content} />
          </div>
        )}
        {status === 'aborted' && (
          <p className="mt-0.5 text-xs text-muted-foreground">Stopped</p>
        )}
      </div>
    </div>
  );
};
