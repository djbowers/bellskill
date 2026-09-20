import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import { OverflowMenu, OverflowMenuAction } from '~/components';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { ProgramSession } from '~/types';

import { WeekGroup, weekContainerId } from '../utils';
import { SessionRow } from './SessionRow';

interface Props {
  group: WeekGroup;
  canEdit: boolean;
  busy: boolean;
  weekActions: OverflowMenuAction[];
  sessionActions: (session: ProgramSession) => OverflowMenuAction[];
  dayNumberOf: (session: ProgramSession, position: number) => number;
  onAddSession: () => void;
}

/** One week of the builder list: header menu, droppable session rows, add button. */
export const WeekSection = ({
  group,
  canEdit,
  busy,
  weekActions,
  sessionActions,
  dayNumberOf,
  onAddSession,
}: Props) => {
  const { setNodeRef, isOver } = useDroppable({
    id: weekContainerId(group.weekNumber),
    disabled: !canEdit,
  });
  const ids = group.sessions.map((s) => s.id);

  return (
    <section
      className="flex flex-col gap-0.5"
      aria-label={`Week ${group.weekNumber}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Week {group.weekNumber}
        </span>
        <OverflowMenu
          actions={weekActions}
          menuLabel={`Week ${group.weekNumber}`}
        />
      </div>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul
          ref={setNodeRef}
          className={cn(
            'flex min-h-4 flex-col rounded-md transition-colors',
            isOver && 'bg-secondary/40',
          )}
        >
          {group.sessions.length === 0 && (
            <li className="py-1 text-center text-xs text-muted-foreground">
              No sessions yet — drag one here or add a session.
            </li>
          )}
          {group.sessions.map((session, index) => (
            <SessionRow
              key={session.id}
              session={session}
              dayNumber={dayNumberOf(session, index + 1)}
              actions={sessionActions(session)}
              draggable={canEdit}
            />
          ))}
        </ul>
      </SortableContext>
      {canEdit && (
        <Button
          size="sm"
          variant="ghost"
          className="self-start text-muted-foreground"
          aria-label={`Add session to week ${group.weekNumber}`}
          onClick={onAddSession}
          disabled={busy}
        >
          + Add session
        </Button>
      )}
    </section>
  );
};
