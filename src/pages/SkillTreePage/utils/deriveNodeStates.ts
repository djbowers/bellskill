import { SkillNodeProgressRow } from '~/api';
import { SkillLevel, SkillNode } from '~/config/skillTree';

export type NodeState = 'complete' | 'active' | 'available' | 'locked';

export interface DerivedNode {
  node: SkillNode;
  state: NodeState;
  missingPrereqIds: string[];
  completedAt: string | null;
}

export interface LevelSummary {
  level: SkillLevel;
  nodes: DerivedNode[];
  completeCount: number;
  totalCount: number;
}

export const deriveNodeStates = (
  nodes: readonly SkillNode[],
  rows: readonly SkillNodeProgressRow[],
): Map<string, DerivedNode> => {
  const knownIds = new Set(nodes.map((n) => n.id));
  const rowById = new Map(
    rows.filter((r) => knownIds.has(r.nodeId)).map((r) => [r.nodeId, r]),
  );

  return new Map(
    nodes.map((node) => {
      const row = rowById.get(node.id);
      const missingPrereqIds = node.prereqs.filter(
        (id) => rowById.get(id)?.status !== 'complete',
      );
      const state: NodeState =
        row?.status === 'complete'
          ? 'complete'
          : row?.status === 'active'
            ? 'active'
            : missingPrereqIds.length === 0
              ? 'available'
              : 'locked';

      return [
        node.id,
        {
          node,
          state,
          missingPrereqIds,
          completedAt: row?.status === 'complete' ? row.completedAt : null,
        },
      ];
    }),
  );
};

export const groupByLevel = (
  derived: ReadonlyMap<string, DerivedNode>,
  levels: readonly SkillLevel[],
): LevelSummary[] =>
  levels.map((level) => {
    const nodes = [...derived.values()].filter(
      (d) => d.node.level === level.level,
    );
    return {
      level,
      nodes,
      completeCount: nodes.filter((d) => d.state === 'complete').length,
      totalCount: nodes.length,
    };
  });
