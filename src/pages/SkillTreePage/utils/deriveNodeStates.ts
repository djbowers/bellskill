import { SkillLevel } from '~/config/skillTree';
import {
  type CompletionSource,
  type DerivedLoad,
  type DerivedNode,
  type LoadEdge,
  type NodeState,
  deriveNodeStates,
} from '~/utils/skillTreeProgress';

export {
  type CompletionSource,
  type DerivedLoad,
  type DerivedNode,
  type LoadEdge,
  type NodeState,
  deriveNodeStates,
};

export interface LevelSummary {
  level: SkillLevel;
  nodes: DerivedNode[];
  completeCount: number;
  totalCount: number;
}

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
