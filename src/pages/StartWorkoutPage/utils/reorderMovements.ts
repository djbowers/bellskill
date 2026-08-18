import { arrayMove } from '@dnd-kit/sortable';

import { MovementOptions } from '~/types';

interface BuilderMovementState {
  movements: MovementOptions[];
  ids: string[];
  collapsed: Set<number>;
}

// Collapsed state is tracked by index, so a move must shift every index in the
// gap between `from` and `to`, the same way removal reindexes the set.
const permuteIndex = (index: number, from: number, to: number): number => {
  if (index === from) return to;
  if (from < index && index <= to) return index - 1;
  if (to <= index && index < from) return index + 1;
  return index;
};

export const reorderMovements = (
  state: BuilderMovementState,
  from: number,
  to: number,
): BuilderMovementState => {
  if (from === to || from < 0 || to < 0) return state;
  return {
    movements: arrayMove(state.movements, from, to),
    ids: arrayMove(state.ids, from, to),
    collapsed: new Set(
      [...state.collapsed].map((index) => permuteIndex(index, from, to)),
    ),
  };
};
