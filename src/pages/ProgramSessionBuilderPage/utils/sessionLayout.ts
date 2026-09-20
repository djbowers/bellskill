import { arrayMove } from '@dnd-kit/sortable';

import { ProgramSession, SessionLayoutEntry } from '~/types';
import { WeekGroup, groupSessionsByWeek } from '~/utils';

export type { WeekGroup };
export const groupByWeek = groupSessionsByWeek;

const WEEK_CONTAINER_PREFIX = 'week-';

/** The droppable id for a week container, distinct from any session id. */
export const weekContainerId = (weekNumber: number) =>
  `${WEEK_CONTAINER_PREFIX}${weekNumber}`;

export const parseWeekContainerId = (id: string | number): number | null => {
  const value = String(id);
  if (!value.startsWith(WEEK_CONTAINER_PREFIX)) return null;
  const weekNumber = Number(value.slice(WEEK_CONTAINER_PREFIX.length));
  return Number.isInteger(weekNumber) ? weekNumber : null;
};

/** Appends `count` empty weeks after the last stored week. */
export const withEmptyWeeks = (
  groups: WeekGroup[],
  count: number,
): WeekGroup[] => {
  const lastWeek = groups.reduce((max, g) => Math.max(max, g.weekNumber), 0);
  const empties = Array.from({ length: count }, (_, i) => ({
    weekNumber: lastWeek + i + 1,
    sessions: [],
  }));
  return [...groups, ...empties];
};

export const trailingEmptyWeekCount = (groups: WeekGroup[]): number => {
  let count = 0;
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i].sessions.length > 0) break;
    count++;
  }
  return count;
};

const findWeekIndex = (groups: WeekGroup[], id: string) => {
  const containerWeek = parseWeekContainerId(id);
  if (containerWeek !== null) {
    return groups.findIndex((g) => g.weekNumber === containerWeek);
  }
  return groups.findIndex((g) => g.sessions.some((s) => s.id === id));
};

const relabelWeeks = (groups: WeekGroup[]): WeekGroup[] =>
  groups.map((group, i) => ({ ...group, weekNumber: i + 1 }));

/**
 * Moves the session `activeId` to where `overId` is — another session (take
 * its slot) or a week container (append to that week). Week numbers are kept
 * as-is; days are renumbered by {@link flattenLayout} at commit time.
 */
export const moveSession = (
  groups: WeekGroup[],
  activeId: string,
  overId: string,
): WeekGroup[] => {
  const fromIndex = findWeekIndex(groups, activeId);
  const toIndex = findWeekIndex(groups, overId);
  if (fromIndex === -1 || toIndex === -1) return groups;

  const from = groups[fromIndex];
  const activeIndex = from.sessions.findIndex((s) => s.id === activeId);
  const active = from.sessions[activeIndex];

  if (fromIndex === toIndex) {
    const overIndex = from.sessions.findIndex((s) => s.id === overId);
    if (overIndex === -1 || overIndex === activeIndex) return groups;
    return groups.map((group, i) =>
      i === fromIndex
        ? {
            ...group,
            sessions: arrayMove(group.sessions, activeIndex, overIndex),
          }
        : group,
    );
  }

  const to = groups[toIndex];
  const overIndex = to.sessions.findIndex((s) => s.id === overId);
  const insertAt = overIndex === -1 ? to.sessions.length : overIndex;
  const toSessions = [...to.sessions];
  toSessions.splice(insertAt, 0, active);

  return groups.map((group, i) => {
    if (i === fromIndex)
      return {
        ...group,
        sessions: group.sessions.filter((s) => s.id !== activeId),
      };
    if (i === toIndex) return { ...group, sessions: toSessions };
    return group;
  });
};

/** Swaps a week with its neighbour and relabels every week by position. */
export const moveWeek = (
  groups: WeekGroup[],
  weekNumber: number,
  direction: -1 | 1,
): WeekGroup[] => {
  const index = groups.findIndex((g) => g.weekNumber === weekNumber);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= groups.length) return groups;
  return relabelWeeks(arrayMove(groups, index, target));
};

export const removeWeek = (
  groups: WeekGroup[],
  weekNumber: number,
): WeekGroup[] =>
  relabelWeeks(groups.filter((g) => g.weekNumber !== weekNumber));

export const addWeek = (groups: WeekGroup[]): WeekGroup[] =>
  withEmptyWeeks(groups, 1);

/**
 * The persisted shape of a grouping: empty weeks dropped, weeks renumbered
 * 1..W and days 1..D by position.
 */
export const flattenLayout = (groups: WeekGroup[]): SessionLayoutEntry[] =>
  groups
    .filter((g) => g.sessions.length > 0)
    .flatMap((group, weekIndex) =>
      group.sessions.map((session, dayIndex) => ({
        id: session.id,
        weekNumber: weekIndex + 1,
        dayNumber: dayIndex + 1,
      })),
    );

export const layoutOf = (sessions: ProgramSession[]): SessionLayoutEntry[] =>
  sessions.map(({ id, weekNumber, dayNumber }) => ({
    id,
    weekNumber,
    dayNumber,
  }));

export const isSameLayout = (
  a: SessionLayoutEntry[],
  b: SessionLayoutEntry[],
): boolean =>
  a.length === b.length &&
  a.every(
    (entry, i) =>
      entry.id === b[i].id &&
      entry.weekNumber === b[i].weekNumber &&
      entry.dayNumber === b[i].dayNumber,
  );

/** Where a new session lands when added to `weekNumber`. */
export const nextSlotInWeek = (groups: WeekGroup[], weekNumber: number) => {
  const group = groups.find((g) => g.weekNumber === weekNumber);
  return { weekNumber, dayNumber: (group?.sessions.length ?? 0) + 1 };
};
