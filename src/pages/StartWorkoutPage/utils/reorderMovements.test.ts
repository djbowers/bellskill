import { describe, expect, it } from 'vitest';

import { DEFAULT_MOVEMENT_OPTIONS } from '~/contexts';
import { MovementOptions } from '~/types';

import { reorderMovements } from './reorderMovements';

const movement = (movementName: string): MovementOptions => ({
  ...DEFAULT_MOVEMENT_OPTIONS,
  movementName,
});

const buildState = (names: string[], collapsed: number[] = []) => ({
  movements: names.map(movement),
  ids: names.map((name) => `id-${name}`),
  collapsed: new Set(collapsed),
});

const names = (state: { movements: MovementOptions[] }) =>
  state.movements.map((m) => m.movementName);

describe('reorderMovements', () => {
  it('moves a movement down and keeps ids aligned', () => {
    const next = reorderMovements(buildState(['a', 'b', 'c']), 0, 2);
    expect(names(next)).toEqual(['b', 'c', 'a']);
    expect(next.ids).toEqual(['id-b', 'id-c', 'id-a']);
  });

  it('moves a movement up and keeps ids aligned', () => {
    const next = reorderMovements(buildState(['a', 'b', 'c']), 2, 0);
    expect(names(next)).toEqual(['c', 'a', 'b']);
    expect(next.ids).toEqual(['id-c', 'id-a', 'id-b']);
  });

  it('shifts collapsed indexes when a movement moves down past them', () => {
    const next = reorderMovements(buildState(['a', 'b', 'c'], [1, 2]), 0, 2);
    expect(next.collapsed).toEqual(new Set([0, 1]));
  });

  it('shifts collapsed indexes when a movement moves up past them', () => {
    const next = reorderMovements(buildState(['a', 'b', 'c'], [0, 1]), 2, 0);
    expect(next.collapsed).toEqual(new Set([1, 2]));
  });

  it('carries a collapsed movement to its new index', () => {
    const next = reorderMovements(buildState(['a', 'b', 'c'], [0]), 0, 2);
    expect(next.collapsed).toEqual(new Set([2]));
  });

  it('returns the state untouched for a no-op move', () => {
    const state = buildState(['a', 'b'], [1]);
    expect(reorderMovements(state, 1, 1)).toBe(state);
  });

  it('returns the state untouched for out-of-range indexes', () => {
    const state = buildState(['a', 'b']);
    expect(reorderMovements(state, -1, 1)).toBe(state);
    expect(reorderMovements(state, 0, -1)).toBe(state);
  });
});
