import { SkillNodeProgressRow } from '~/api';
import { SKILL_LEVELS, SKILL_NODES } from '~/config/skillTree';

import { deriveNodeStates, groupByLevel } from './deriveNodeStates';

const row = (
  nodeId: string,
  status: SkillNodeProgressRow['status'],
  completedAt: string | null = status === 'complete' ? '2026-09-01T00:00:00Z' : null,
): SkillNodeProgressRow => ({ nodeId, status, completedAt });

const stateOf = (rows: SkillNodeProgressRow[], id: string) =>
  deriveNodeStates(SKILL_NODES, rows).get(id)!;

describe('deriveNodeStates', () => {
  test('with no progress, entry nodes are available and gated nodes are locked', () => {
    expect(stateOf([], 'L1-N1').state).toBe('available');
    expect(stateOf([], 'L2-M1').state).toBe('available');
    expect(stateOf([], 'L1-N4')).toMatchObject({
      state: 'locked',
      missingPrereqIds: ['L1-N1'],
    });
  });

  test('completing a prerequisite makes the dependent node available', () => {
    expect(stateOf([row('L1-N1', 'complete')], 'L1-N4').state).toBe('available');
  });

  test('an active node stays active even when prerequisites are missing', () => {
    expect(stateOf([row('L1-N4', 'active')], 'L1-N4')).toMatchObject({
      state: 'active',
      missingPrereqIds: ['L1-N1'],
      completedAt: null,
    });
  });

  test('a complete node carries its completion timestamp', () => {
    expect(stateOf([row('L1-N1', 'complete')], 'L1-N1')).toMatchObject({
      state: 'complete',
      completedAt: '2026-09-01T00:00:00Z',
    });
  });

  test('ignores rows for ids that are no longer in the map', () => {
    const derived = deriveNodeStates(SKILL_NODES, [row('L0-N9', 'complete')]);
    expect(derived.size).toBe(SKILL_NODES.length);
    expect(derived.has('L0-N9')).toBe(false);
  });
});

describe('groupByLevel', () => {
  test('returns nine summaries in level order with per-level counts', () => {
    const empty = groupByLevel(deriveNodeStates(SKILL_NODES, []), SKILL_LEVELS);
    expect(empty.map((s) => s.level.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(empty[0]).toMatchObject({ completeCount: 0, totalCount: 6 });

    const two = groupByLevel(
      deriveNodeStates(SKILL_NODES, [
        row('L1-N1', 'complete'),
        row('L1-N2', 'complete'),
        row('L1-N3', 'active'),
      ]),
      SKILL_LEVELS,
    );
    expect(two[0]).toMatchObject({ completeCount: 2, totalCount: 6 });
    expect(two[1].completeCount).toBe(0);
  });
});
