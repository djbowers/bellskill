import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/solid';
import { DateTime } from 'luxon';
import { useState } from 'react';

import { useChalkThreads, useDeleteChalkThread } from '~/api';
import { ConfirmDialog } from '~/components';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import { cn } from '~/lib/utils';
import type { ChalkThread } from '~/types';

interface ThreadMenuProps {
  /** The conversation on screen, or null for an unsaved new one. */
  currentThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onNewThread: () => void;
}

const threadLabel = (thread: ChalkThread) =>
  thread.title?.trim() || 'Untitled conversation';

const relativeTime = (iso: string) =>
  DateTime.fromISO(iso).toRelative() ?? 'Just now';

export const ThreadMenu = ({
  currentThreadId,
  onSelectThread,
  onNewThread,
}: ThreadMenuProps) => {
  const [open, setOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ChalkThread | null>(null);

  // Only fetch the list while the sheet is open — the chat itself never needs it.
  const { data: threads = [], isLoading } = useChalkThreads({ enabled: open });
  const deleteThread = useDeleteChalkThread();

  const select = (threadId: string) => {
    onSelectThread(threadId);
    setOpen(false);
  };

  const startNew = () => {
    onNewThread();
    setOpen(false);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    deleteThread.mutate(id, {
      onSuccess: () => {
        // Deleting the open conversation leaves nothing to show, so fall back
        // to a fresh one rather than rendering a thread that no longer exists.
        if (id === currentThreadId) onNewThread();
        setPendingDelete(null);
      },
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Conversations"
            className="text-muted-foreground"
          >
            <ChatBubbleLeftRightIcon className="h-2.5 w-2.5" aria-hidden />
          </Button>
        </DialogTrigger>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conversations</DialogTitle>
          </DialogHeader>

          <Button onClick={startNew} className="w-full">
            <PlusIcon className="mr-0.5 h-2 w-2" aria-hidden />
            New conversation
          </Button>

          <div className="flex max-h-[50vh] flex-col gap-0.5 overflow-y-auto overscroll-contain">
            {isLoading && (
              <p className="py-1 text-center text-sm text-muted-foreground">
                Loading…
              </p>
            )}

            {!isLoading && threads.length === 0 && (
              <p className="py-1 text-center text-sm text-muted-foreground">
                No past conversations yet.
              </p>
            )}

            {threads.map((thread) => {
              const isCurrent = thread.id === currentThreadId;
              return (
                <div
                  key={thread.id}
                  className={cn(
                    'flex items-center gap-1 rounded-md px-1 py-0.5',
                    isCurrent && 'bg-primary/10',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => select(thread.id)}
                    aria-current={isCurrent ? 'true' : undefined}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-sm">
                      {threadLabel(thread)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {relativeTime(thread.lastMessageAt)}
                    </span>
                  </button>

                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${threadLabel(thread)}`}
                    className="shrink-0 text-muted-foreground"
                    onClick={() => setPendingDelete(thread)}
                  >
                    <TrashIcon className="h-2 w-2" aria-hidden />
                  </Button>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(next) => !next && setPendingDelete(null)}
        title="Delete this conversation?"
        description={
          pendingDelete
            ? `“${threadLabel(pendingDelete)}” and its messages will be gone for good.`
            : ''
        }
        confirmLabel="Delete"
        confirmVariant="destructive"
        dismissLabel="Keep it"
        onConfirm={confirmDelete}
        onDismiss={() => setPendingDelete(null)}
        isPending={deleteThread.isPending}
      />
    </>
  );
};
