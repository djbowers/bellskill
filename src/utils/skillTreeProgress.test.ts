import { SKILL_NODES } from '~/config/skillTree';

import {
  type SkillProgressRow,
  assessSkillReach,
  describeNode,
  groupProgramSkillNodes,
  isWithinReach,
  reachLabel,
  summarizeSkillTree,
} from './skillTreeProgress';

const row = (
  nodeId: string,
  status: SkillProgressRow['status'],
): SkillProgressRow => ({
  nodeId,
  status,
  completedAt: status === 'complete' ? '2026-09-01T00:00:00Z' : null,
});

const passed = (...ids: string[]) => ids.map((id) => row(id, 'complete'));

const beginner = [...passed('L1-N1', 'L1-N2', 'L1-N3'), row('L2-N2', 'active')];

const levelsOneToFive = SKILL_NODES.filter((n) => n.level <= 5).map((n) => n.id);
const intermediate = [
  ...passed(...levelsOneToFive, 'L6-N3'),
  row('L7-N1', 'active'),
];

describe('summarizeSkillTree', () => {
  test('is null with no rows, or only rows the map no longer knows', () => {
    expect(summarizeSkillTree([])).toBeNull();
    expect(summarizeSkillTree([row('L0-N9', 'complete')])).toBeNull();
  });

  test('places a beginner on the map', () => {
    const summary = summarizeSkillTree(beginner)!;
    expect(summary.passed).toEqual(['L1-N1', 'L1-N2', 'L1-N3']);
    expect(summary.practicing).toEqual(['L2-N2']);
    expect(summary.ready).toEqual([
      'L1-N4',
      'L1-N5',
      'L1-N6',
      'L2-M1',
      'L2-N1',
      'L3-M1',
      'L4-M1',
      'L5-M1',
      'L6-M1',
      'L7-M1',
    ]);
    expect(summary.levels[0]).toEqual({
      level: 1,
      title: 'Foundation',
      passed: 3,
      total: 6,
    });
    expect(summary.levels.map((l) => l.passed)).toEqual([3, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  test('places an intermediate lifter on the map', () => {
    const summary = summarizeSkillTree(intermediate)!;
    expect(summary.passed).toHaveLength(24);
    expect(summary.practicing).toEqual(['L7-N1']);
    expect(summary.ready).toEqual(['L6-M1', 'L7-M1', 'L8-M1']);
    expect(summary.levels.map((l) => l.passed)).toEqual([6, 4, 3, 5, 5, 1, 0, 0, 0]);
  });
});

describe('isWithinReach', () => {
  const summary = summarizeSkillTree(beginner);

  test('never gates without a summary, a node, or a known id', () => {
    expect(isWithinReach(null, 'L9-N1')).toBe(true);
    expect(isWithinReach(summary, null)).toBe(true);
    expect(isWithinReach(summary, 'L0-N9')).toBe(true);
  });

  test('passed, practicing and ready nodes are in reach; the rest are not', () => {
    expect(isWithinReach(summary, 'L1-N1')).toBe(true);
    expect(isWithinReach(summary, 'L2-N2')).toBe(true);
    expect(isWithinReach(summary, 'L2-N1')).toBe(true);
    expect(isWithinReach(summary, 'L3-N1')).toBe(false);
    expect(isWithinReach(summary, 'L8-N1')).toBe(false);
  });

  test('a practicing node with missing prerequisites is still in reach', () => {
    const clean = summarizeSkillTree([row('L4-N1', 'active')]);
    expect(isWithinReach(clean, 'L4-N1')).toBe(true);
  });

  test('prerequisites implied by passed or practicing nodes are in reach', () => {
    const clean = summarizeSkillTree([row('L4-N1', 'active')]);
    expect(isWithinReach(clean, 'L3-N1')).toBe(true);
    expect(isWithinReach(clean, 'L2-N2')).toBe(true);
    expect(isWithinReach(clean, 'L1-N2')).toBe(true);
    expect(isWithinReach(clean, 'L4-N3')).toBe(false);
  });

  test('the intermediate fixture keeps snatch and the loaded get-up out of reach', () => {
    const summary = summarizeSkillTree(intermediate);
    expect(isWithinReach(summary, 'L7-N1')).toBe(true);
    expect(isWithinReach(summary, 'L8-N1')).toBe(false);
    expect(isWithinReach(summary, 'L6-N1')).toBe(false);
    expect(isWithinReach(summary, 'L8-N3')).toBe(false);
  });
});

describe('reachLabel', () => {
  test('labels the three in-reach states and nothing else', () => {
    const summary = summarizeSkillTree(beginner)!;
    expect(reachLabel(summary, 'L1-N1')).toBe('passed');
    expect(reachLabel(summary, 'L2-N2')).toBe('practicing');
    expect(reachLabel(summary, 'L2-N1')).toBe('ready');
    expect(reachLabel(summary, 'L3-N1')).toBeNull();
  });
});

describe('describeNode', () => {
  test('describes a node with its level title', () => {
    expect(describeNode('L2-N2')).toMatchObject({
      level: 2,
      levelTitle: 'First load',
      title: 'Two-hand swing',
      kind: 'movement',
    });
  });

  test('is null for an id not on the map', () => {
    expect(describeNode('L0-N9')).toBeNull();
  });
});

describe('assessSkillReach', () => {
  test('is within reach with no summary or no nodes', () => {
    expect(assessSkillReach(['L9-N1'], null)).toEqual({
      verdict: 'within_reach',
      out_of_reach_nodes: [],
    });
    expect(assessSkillReach([], summarizeSkillTree(beginner))).toEqual({
      verdict: 'within_reach',
      out_of_reach_nodes: [],
    });
  });

  test('lists the out-of-reach nodes in map order', () => {
    const summary = summarizeSkillTree(beginner);
    expect(assessSkillReach(['L7-N2', 'L2-N2', 'L7-N1', 'L3-N1'], summary)).toEqual({
      verdict: 'stretch',
      out_of_reach_nodes: ['L3-N1', 'L7-N1', 'L7-N2'],
    });
  });
});

describe('groupProgramSkillNodes', () => {
  test('groups rows per program without duplicates', () => {
    const grouped = groupProgramSkillNodes([
      { program_id: 'a', skill_node_id: 'L3-N1' },
      { program_id: 'a', skill_node_id: 'L6-N1' },
      { program_id: 'a', skill_node_id: 'L3-N1' },
      { program_id: 'b', skill_node_id: 'L7-N1' },
    ]);
    expect(grouped.get('a')).toEqual(['L3-N1', 'L6-N1']);
    expect(grouped.get('b')).toEqual(['L7-N1']);
  });
});
