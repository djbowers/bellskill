import { Program } from '~/types';
import { programCadenceLabel } from '~/utils';

/**
 * What one of your own programs is currently able to do. Exactly one primary
 * CTA and one visual treatment follow from this, and it is also what "My
 * programs" sorts on.
 */
export type MyProgramCardState = 'active' | 'queued' | 'ready' | 'draft';

export const myProgramCardState = (
  program: Program,
  { isActive, isQueued }: { isActive: boolean; isQueued: boolean },
): MyProgramCardState => {
  if (isActive) return 'active';
  if (isQueued) return 'queued';
  // No cadence means no sessions have given it one yet — nothing to start.
  return programCadenceLabel(program) === null ? 'draft' : 'ready';
};

// What's in motion first, then what you could start today, then what isn't
// finished being built. Sorting is stable, so ties keep the order they came in.
const SORT_WEIGHT: Record<MyProgramCardState, number> = {
  active: 0,
  queued: 1,
  ready: 2,
  draft: 3,
};

export const myProgramCardSortWeight = (state: MyProgramCardState): number =>
  SORT_WEIGHT[state];
