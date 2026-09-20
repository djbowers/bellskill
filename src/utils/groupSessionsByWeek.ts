import { ProgramSession } from '~/types';

export interface WeekGroup {
  weekNumber: number;
  sessions: ProgramSession[];
}

/** Sessions grouped by their 1-based week, preserving `sequenceIndex` order. */
export const groupSessionsByWeek = (
  sessions: ProgramSession[],
): WeekGroup[] => {
  const groups: WeekGroup[] = [];
  for (const session of sessions) {
    const group = groups.find((g) => g.weekNumber === session.weekNumber);
    if (group) group.sessions.push(session);
    else groups.push({ weekNumber: session.weekNumber, sessions: [session] });
  }
  return groups;
};
