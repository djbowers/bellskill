import type { ChalkMessage } from '~/types';

import { useAutoScroll } from '../hooks/useAutoScroll';
import { MessageBubble } from './MessageBubble';

interface MessageListProps {
  messages: ChalkMessage[];
  /** The user's turn, rendered before the server has confirmed it. */
  pendingMessage: string | null;
  isSending: boolean;
}

export const MessageList = ({
  messages,
  pendingMessage,
  isSending,
}: MessageListProps) => {
  const { ref, onScroll } = useAutoScroll(
    `${messages.length}:${pendingMessage ?? ''}:${isSending}`,
  );

  return (
    // A plain scroll container, deliberately not Radix ScrollArea: that replaces
    // native scrolling and kills iOS momentum in a long chat.
    <div
      ref={ref}
      onScroll={onScroll}
      className="flex-1 overflow-y-auto overscroll-contain"
      data-testid="chalk-message-list"
    >
      <div className="mx-auto flex w-full max-w-md flex-col gap-1 p-1.5">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            role={message.role}
            content={message.content}
            status={message.status}
          />
        ))}

        {pendingMessage && (
          <MessageBubble role="user" content={pendingMessage} pending />
        )}

        {isSending && (
          <div
            className="flex justify-start"
            role="status"
            aria-label="Chalk is thinking"
          >
            <div className="rounded-md bg-muted px-1.5 py-1 text-sm text-muted-foreground">
              Thinking…
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
