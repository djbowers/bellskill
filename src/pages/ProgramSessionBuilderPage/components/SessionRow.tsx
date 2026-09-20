import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { OverflowMenu, OverflowMenuAction } from '~/components';
import { cn } from '~/lib/utils';
import { ProgramSession } from '~/types';

interface Props {
  session: ProgramSession;
  /** Position within its (possibly draft) week, 1-based. */
  dayNumber: number;
  actions: OverflowMenuAction[];
  draggable: boolean;
}

/** One session in the builder's week list; the day badge doubles as the drag handle. */
export const SessionRow = ({
  session,
  dayNumber,
  actions,
  draggable,
}: Props) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: session.id, disabled: !draggable });

  const badgeClassName =
    'flex h-3 w-3 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-semibold tabular-nums text-muted-foreground';

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-1 border-b border-border/60 bg-card py-0.5 last:border-b-0',
        isDragging && 'relative z-10 opacity-70 shadow-lg',
      )}
    >
      {draggable ? (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${session.title}`}
          className={cn(
            badgeClassName,
            'cursor-grab touch-none active:cursor-grabbing',
          )}
        >
          {dayNumber}
        </button>
      ) : (
        <span aria-hidden className={badgeClassName}>
          {dayNumber}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-sm">
        <span className="sr-only">Day {dayNumber}: </span>
        {session.title}
      </span>
      <OverflowMenu actions={actions} menuLabel={session.title} />
    </li>
  );
};
