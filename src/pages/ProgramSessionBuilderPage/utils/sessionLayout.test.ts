import { ProgramSession } from '~/types';

import {
  addWeek,
  flattenLayout,
  groupByWeek,
  isSameLayout,
  layoutOf,
  moveSession,
  moveWeek,
  nextSlotInWeek,
  parseWeekContainerId,
  removeWeek,
  trailingEmptyWeekCount,
  weekContainerId,
  withEmptyWeeks,
} from './sessionLayout';

const session = (
  id: string,
  sequenceIndex: number,
  weekNumber: number,
  dayNumber: number,
): ProgramSession =>
  ({ id, sequenceIndex, weekNumber, dayNumber, title: id }) as ProgramSession;

// Week 1: a, b · Week 2: c
const sessions = [
  session('a', 0, 1, 1),
  session('b', 1, 1, 2),
  session('c', 2, 2, 1),
];
const groups = groupByWeek(sessions);

const ids = (g: ReturnType<typeof groupByWeek>) =>
  g.map((group) => [group.weekNumber, group.sessions.map((s) => s.id)]);

describe('groupByWeek', () => {
  it('groups by week in first-seen order', () => {
    expect(ids(groups)).toEqual([
      [1, ['a', 'b']],
      [2, ['c']],
    ]);
  });
});

describe('week container ids', () => {
  it('round-trips and rejects session ids', () => {
    expect(parseWeekContainerId(weekContainerId(3))).toBe(3);
    expect(parseWeekContainerId('a')).toBeNull();
  });
});

describe('withEmptyWeeks / trailingEmptyWeekCount / addWeek', () => {
  it('appends empty weeks after the last stored week', () => {
    expect(ids(withEmptyWeeks(groups, 2))).toEqual([
      [1, ['a', 'b']],
      [2, ['c']],
      [3, []],
      [4, []],
    ]);
    expect(trailingEmptyWeekCount(withEmptyWeeks(groups, 2))).toBe(2);
    expect(trailingEmptyWeekCount(groups)).toBe(0);
    expect(ids(addWeek(groups))).toEqual([
      [1, ['a', 'b']],
      [2, ['c']],
      [3, []],
    ]);
  });
});

describe('moveSession', () => {
  it('reorders within a week', () => {
    expect(ids(moveSession(groups, 'a', 'b'))).toEqual([
      [1, ['b', 'a']],
      [2, ['c']],
    ]);
  });

  it('moves across weeks onto a row, taking its slot', () => {
    expect(ids(moveSession(groups, 'c', 'a'))).toEqual([
      [1, ['c', 'a', 'b']],
      [2, []],
    ]);
  });

  it('moves onto a week container, appending', () => {
    expect(ids(moveSession(groups, 'a', weekContainerId(2)))).toEqual([
      [1, ['b']],
      [2, ['c', 'a']],
    ]);
  });

  it('is a no-op for unknown ids or dropping onto itself', () => {
    expect(moveSession(groups, 'a', 'zzz')).toBe(groups);
    expect(moveSession(groups, 'a', 'a')).toBe(groups);
  });
});

describe('moveWeek / removeWeek', () => {
  it('swaps neighbours and relabels by position', () => {
    expect(ids(moveWeek(groups, 2, -1))).toEqual([
      [1, ['c']],
      [2, ['a', 'b']],
    ]);
    expect(moveWeek(groups, 1, -1)).toBe(groups);
    expect(moveWeek(groups, 2, 1)).toBe(groups);
  });

  it('removes a week and closes the gap', () => {
    expect(ids(removeWeek(withEmptyWeeks(groups, 1), 1))).toEqual([
      [1, ['c']],
      [2, []],
    ]);
  });
});

describe('flattenLayout / layoutOf / isSameLayout', () => {
  it('drops empty weeks and renumbers weeks and days', () => {
    const moved = moveSession(withEmptyWeeks(groups, 1), 'c', 'a');
    expect(flattenLayout(moved)).toEqual([
      { id: 'c', weekNumber: 1, dayNumber: 1 },
      { id: 'a', weekNumber: 1, dayNumber: 2 },
      { id: 'b', weekNumber: 1, dayNumber: 3 },
    ]);
  });

  it('matches the stored layout when nothing moved', () => {
    expect(isSameLayout(flattenLayout(groups), layoutOf(sessions))).toBe(true);
    expect(
      isSameLayout(
        flattenLayout(moveSession(groups, 'a', 'b')),
        layoutOf(sessions),
      ),
    ).toBe(false);
  });
});

describe('nextSlotInWeek', () => {
  it('appends after the last day, or day 1 for an empty week', () => {
    expect(nextSlotInWeek(groups, 1)).toEqual({ weekNumber: 1, dayNumber: 3 });
    expect(nextSlotInWeek(groups, 3)).toEqual({ weekNumber: 3, dayNumber: 1 });
  });
});
