import { SkillNodeProgressRow } from '~/api';
import { SKILL_LEVELS, SKILL_NODES } from '~/config/skillTree';
import { BellKg, LoadEdge } from '~/utils';

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

describe('deriveNodeStates with a load edge', () => {
  const edges = (entries: Record<string, BellKg>): Map<string, LoadEdge> =>
    new Map(
      Object.entries(entries).map(([nodeId, edgeKg]) => [
        nodeId,
        { edgeKg, reachedAt: new Date('2026-08-30T00:00:00Z') },
      ]),
    );

  const withEdges = (
    rows: SkillNodeProgressRow[],
    entries: Record<string, BellKg>,
    id: string,
  ) => deriveNodeStates(SKILL_NODES, rows, edges(entries)).get(id)!;

  test('reaching the target bell passes the node without a row', () => {
    // L2-N2 two-hand swing targets 24kg.
    expect(withEdges([], { 'L2-N2': 24 }, 'L2-N2')).toMatchObject({
      state: 'complete',
      completionSource: 'logs',
      completedAt: '2026-08-30T00:00:00.000Z',
    });
  });

  test('an edge below the target leaves the node where it was', () => {
    // Still gated on the hip hinge, exactly as it is with no logs at all.
    expect(withEdges([], { 'L2-N2': 16 }, 'L2-N2')).toMatchObject({
      state: 'locked',
      missingPrereqIds: ['L1-N2'],
      completionSource: null,
    });
  });

  test('surfaces the edge, target, and next rung for a loaded node', () => {
    expect(withEdges([], { 'L8-N1': 20 }, 'L8-N1').load).toMatchObject({
      edgeKg: 20,
      targetKg: 20,
      nextKg: null,
    });
    expect(withEdges([], { 'L2-N2': 16 }, 'L2-N2').load).toMatchObject({
      edgeKg: 16,
      targetKg: 24,
      nextKg: 20,
    });
  });

  test('a node with no load carries no load block', () => {
    expect(withEdges([], {}, 'L1-N1').load).toBeNull();
  });

  test('an auto-passed prerequisite unlocks the node above it', () => {
    // L3-N1 single-hand swing requires L2-N2, whose 24kg target the logs meet.
    expect(withEdges([], { 'L2-N2': 24 }, 'L3-N1')).toMatchObject({
      state: 'available',
      missingPrereqIds: [],
    });
  });

  test('a hand-marked pass keeps its own date and source', () => {
    expect(
      withEdges([row('L2-N2', 'complete')], { 'L2-N2': 24 }, 'L2-N2'),
    ).toMatchObject({
      state: 'complete',
      completionSource: 'manual',
      completedAt: '2026-09-01T00:00:00Z',
    });
  });

  test('an active node still passes once the logs reach the target', () => {
    expect(withEdges([row('L2-N2', 'active')], { 'L2-N2': 24 }, 'L2-N2')).toMatchObject({
      state: 'complete',
      completionSource: 'logs',
    });
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
