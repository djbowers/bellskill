import {
  CollisionDetection,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { Announcements } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useState } from 'react';

import { OverflowMenuAction } from '~/components';
import { ProgramSession } from '~/types';

import { WeekGroup, moveSession, parseWeekContainerId } from '../utils';
import { WeekSection } from './WeekSection';

interface Props {
  groups: WeekGroup[];
  canEdit: boolean;
  busy: boolean;
  /** A drop that changed the grouping; the page flattens and persists it. */
  onLayoutChange: (next: WeekGroup[]) => void;
  weekActions: (group: WeekGroup, index: number) => OverflowMenuAction[];
  sessionActions: (session: ProgramSession) => OverflowMenuAction[];
  onAddSession: (weekNumber: number) => void;
}

// The keyboard sensor has no pointer, so it needs the geometric fallback.
const collisionDetection: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  return within.length > 0 ? within : closestCorners(args);
};

/** The builder's week-grouped session list with cross-week drag-and-drop. */
export const SessionWeekList = ({
  groups,
  canEdit,
  busy,
  onLayoutChange,
  weekActions,
  sessionActions,
  onAddSession,
}: Props) => {
  // The grouping as it looks mid-drag, so the destination week owns the row
  // before it drops. Null whenever nothing is being dragged.
  const [draftGroups, setDraftGroups] = useState<WeekGroup[] | null>(null);
  const shown = draftGroups ?? groups;
  // Badges keep their committed day numbers until the drop lands, so rows
  // don't renumber under the pointer mid-drag.
  const committedDay = new Map(
    groups.flatMap((g) => g.sessions.map((s, i) => [s.id, i + 1])),
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const describe = (id: string | number) => {
    for (const group of shown) {
      const index = group.sessions.findIndex((s) => s.id === id);
      if (index !== -1) return `week ${group.weekNumber}, day ${index + 1}`;
    }
    const week = parseWeekContainerId(id);
    return week === null ? 'nowhere' : `week ${week}`;
  };
  const title = (id: string | number) =>
    shown.flatMap((g) => g.sessions).find((s) => s.id === id)?.title ??
    'Session';

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Picked up ${title(active.id)} from ${describe(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${title(active.id)} is over ${describe(over.id)}.`
        : `${title(active.id)} is no longer over a week.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${title(active.id)} dropped at ${describe(over.id)}.`
        : `${title(active.id)} dropped.`,
    onDragCancel: ({ active }) =>
      `Move cancelled. ${title(active.id)} returned to its place.`,
  };

  const weekOf = (id: string | number) =>
    parseWeekContainerId(id) ??
    shown.find((g) => g.sessions.some((s) => s.id === id))?.weekNumber ??
    null;

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || weekOf(active.id) === weekOf(over.id)) return;
    setDraftGroups(moveSession(shown, String(active.id), String(over.id)));
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const next = over
      ? moveSession(shown, String(active.id), String(over.id))
      : shown;
    setDraftGroups(null);
    if (next !== groups) onLayoutChange(next);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      modifiers={[restrictToVerticalAxis]}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      accessibility={{ announcements }}
      onDragStart={() => setDraftGroups(groups)}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraftGroups(null)}
    >
      {shown.map((group, index) => (
        <WeekSection
          key={group.weekNumber}
          group={group}
          canEdit={canEdit}
          busy={busy}
          weekActions={weekActions(group, index)}
          sessionActions={sessionActions}
          dayNumberOf={(session, position) =>
            draftGroups ? (committedDay.get(session.id) ?? position) : position
          }
          onAddSession={() => onAddSession(group.weekNumber)}
        />
      ))}
    </DndContext>
  );
};
