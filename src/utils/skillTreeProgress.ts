// Skill-tree progress, derived from a lifter's self-assessed rows. Pure and
// serializable so the recommender edge functions and the eval runner can share
// it with the SkillTreePage. Extension-qualified relative imports only: the
// Deno edge runtime cannot resolve `~`.
//
// Vocabulary: the page's `available` state is what prompts and summaries call
// `ready` (NODE_STATE_LABELS.available = 'Ready').
import {
  SKILL_LEVELS,
  SKILL_NODES,
  SKILL_NODE_BY_ID,
  type SkillNode,
} from '../config/skillTree.ts';
import { type BellKg, nextBell } from './bellLadder.ts';

export type SkillNodeStatus = 'active' | 'complete';

/** Structurally identical to SkillNodeProgressRow in src/api, minus the `~` import. */
export interface SkillProgressRow {
  nodeId: string;
  status: SkillNodeStatus;
  completedAt: string | null;
}

export type NodeState = 'complete' | 'active' | 'available' | 'locked';

/** Whether a node was passed by hand or by the bells in the lifter's logs. */
export type CompletionSource = 'manual' | 'logs';

/** The heaviest bell logged for a node, and when it was first reached. */
export interface LoadEdge {
  edgeKg: BellKg | null;
  reachedAt: Date | null;
}

export interface DerivedLoad {
  edgeKg: BellKg | null;
  targetKg: BellKg;
  nextKg: BellKg | null;
  reachedAt: Date | null;
}

export interface DerivedNode {
  node: SkillNode;
  state: NodeState;
  missingPrereqIds: string[];
  completedAt: string | null;
  completionSource: CompletionSource | null;
  /** null on nodes no bell can be added to. */
  load: DerivedLoad | null;
}

const deriveLoad = (
  node: SkillNode,
  edges: ReadonlyMap<string, LoadEdge>,
): DerivedLoad | null => {
  if (node.targetKg === undefined) return null;

  const edge = edges.get(node.id);
  const edgeKg = edge?.edgeKg ?? null;

  return {
    edgeKg,
    targetKg: node.targetKg,
    nextKg: edgeKg !== null && edgeKg >= node.targetKg ? null : nextBell(edgeKg),
    reachedAt: edge?.reachedAt ?? null,
  };
};

export const deriveNodeStates = (
  nodes: readonly SkillNode[],
  rows: readonly SkillProgressRow[],
  edges: ReadonlyMap<string, LoadEdge> = new Map(),
): Map<string, DerivedNode> => {
  const knownIds = new Set(nodes.map((n) => n.id));
  const rowById = new Map(
    rows.filter((r) => knownIds.has(r.nodeId)).map((r) => [r.nodeId, r]),
  );

  const loadById = new Map(
    nodes.map((node) => [node.id, deriveLoad(node, edges)] as const),
  );

  // A node the logs have already carried to its target bell counts as passed
  // wherever completion is read, prerequisites included — so an auto-passed
  // swing unlocks the clean the same way a hand-marked one does.
  const completionSourceById = new Map<string, CompletionSource | null>(
    nodes.map((node) => {
      const load = loadById.get(node.id) ?? null;
      if (rowById.get(node.id)?.status === 'complete') return [node.id, 'manual'];
      if (load?.edgeKg != null && load.edgeKg >= load.targetKg)
        return [node.id, 'logs'];
      return [node.id, null];
    }),
  );

  return new Map(
    nodes.map((node) => {
      const row = rowById.get(node.id);
      const load = loadById.get(node.id) ?? null;
      const completionSource = completionSourceById.get(node.id) ?? null;
      const missingPrereqIds = node.prereqs.filter(
        (id) => completionSourceById.get(id) == null,
      );

      const state: NodeState = completionSource
        ? 'complete'
        : row?.status === 'active'
          ? 'active'
          : missingPrereqIds.length === 0
            ? 'available'
            : 'locked';

      const completedAt =
        completionSource === 'manual'
          ? (row?.completedAt ?? null)
          : completionSource === 'logs'
            ? (load?.reachedAt?.toISOString() ?? null)
            : null;

      return [
        node.id,
        { node, state, missingPrereqIds, completedAt, completionSource, load },
      ];
    }),
  );
};

export interface SkillTreeLevelSummary {
  level: number;
  title: string;
  passed: number;
  total: number;
}

/**
 * The lifter's position on the map, as node ids in SKILL_NODES order. Persisted
 * into *_recommendations.inputs. Every id absent from the three lists is not
 * yet in reach — except the prerequisites implied by passed and practicing
 * nodes, which isWithinReach treats as reachable.
 */
export interface SkillTreeSummary {
  passed: string[];
  practicing: string[];
  ready: string[];
  levels: SkillTreeLevelSummary[];
}

/** null when the lifter has no rows on the map: no prompt section, no ceiling. */
export const summarizeSkillTree = (
  rows: readonly SkillProgressRow[],
): SkillTreeSummary | null => {
  if (!rows.some((r) => SKILL_NODE_BY_ID.has(r.nodeId))) return null;

  const derived = [...deriveNodeStates(SKILL_NODES, rows).values()];
  const idsIn = (state: NodeState) =>
    derived.filter((d) => d.state === state).map((d) => d.node.id);

  return {
    passed: idsIn('complete'),
    practicing: idsIn('active'),
    ready: idsIn('available'),
    levels: SKILL_LEVELS.map((level) => {
      const atLevel = derived.filter((d) => d.node.level === level.level);
      return {
        level: level.level,
        title: level.title,
        passed: atLevel.filter((d) => d.state === 'complete').length,
        total: atLevel.length,
      };
    }),
  };
};

/** Every prerequisite, transitively, of the given nodes (excluding themselves). */
const impliedPrereqs = (nodeIds: readonly string[]): Set<string> => {
  const implied = new Set<string>();
  const stack = [...nodeIds];
  while (stack.length > 0) {
    const node = SKILL_NODE_BY_ID.get(stack.pop()!);
    for (const prereq of node?.prereqs ?? []) {
      if (!implied.has(prereq)) {
        implied.add(prereq);
        stack.push(prereq);
      }
    }
  }
  return implied;
};

export const reachableNodeIds = (summary: SkillTreeSummary): Set<string> =>
  new Set([
    ...summary.passed,
    ...summary.practicing,
    ...summary.ready,
    ...impliedPrereqs([...summary.passed, ...summary.practicing]),
  ]);

/**
 * Whether a movement practising `nodeId` may be prescribed. Always true with no
 * summary, no node, or an id the map no longer knows — the ceiling only ever
 * removes nodes it can place.
 */
export const isWithinReach = (
  summary: SkillTreeSummary | null,
  nodeId: string | null | undefined,
): boolean => {
  if (!summary || !nodeId || !SKILL_NODE_BY_ID.has(nodeId)) return true;
  return reachableNodeIds(summary).has(nodeId);
};

export type ReachLabel = 'passed' | 'practicing' | 'ready';

export const reachLabel = (
  summary: SkillTreeSummary,
  nodeId: string,
): ReachLabel | null =>
  summary.passed.includes(nodeId)
    ? 'passed'
    : summary.practicing.includes(nodeId)
      ? 'practicing'
      : summary.ready.includes(nodeId)
        ? 'ready'
        : null;

export interface SkillNodeDescription {
  id: string;
  level: number;
  levelTitle: string;
  title: string;
  kind: SkillNode['kind'];
  skills: string[];
  benchmark: string;
}

/** null for an id not on the map (a stale catalog value) — never throws. */
export const describeNode = (nodeId: string): SkillNodeDescription | null => {
  const node = SKILL_NODE_BY_ID.get(nodeId);
  if (!node) return null;
  const level = SKILL_LEVELS.find((l) => l.level === node.level);
  return {
    id: node.id,
    level: node.level,
    levelTitle: level?.title ?? `Level ${node.level}`,
    title: node.title,
    kind: node.kind,
    skills: node.skills,
    benchmark: node.benchmark,
  };
};

/** Whether a program's prescribed skills sit inside the lifter's reach. */
export interface SkillReach {
  verdict: 'within_reach' | 'stretch';
  /** Node ids out of reach, in map order. Empty for within_reach. */
  out_of_reach_nodes: string[];
}

export const assessSkillReach = (
  nodeIds: readonly string[],
  summary: SkillTreeSummary | null,
): SkillReach => {
  const wanted = new Set(nodeIds);
  const out_of_reach_nodes = SKILL_NODES.filter(
    (node) => wanted.has(node.id) && !isWithinReach(summary, node.id),
  ).map((node) => node.id);
  return {
    verdict: out_of_reach_nodes.length === 0 ? 'within_reach' : 'stretch',
    out_of_reach_nodes,
  };
};

/** Group flat program_skill_node_movements rows into a per-program node list. */
export const groupProgramSkillNodes = (
  rows: readonly { program_id: string; skill_node_id: string }[],
): Map<string, string[]> => {
  const byProgram = new Map<string, string[]>();
  for (const row of rows) {
    const list = byProgram.get(row.program_id) ?? [];
    if (!list.includes(row.skill_node_id)) list.push(row.skill_node_id);
    byProgram.set(row.program_id, list);
  }
  return byProgram;
};
