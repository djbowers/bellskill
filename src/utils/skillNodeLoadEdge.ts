import { WeightUnit } from '~/types';

import { BellKg, LoadEdge, snapToBell } from './bellLadder';
import {
  MovementWeightModeFields,
  getWeightTabValue,
  movementMatchesWeightMode,
} from './movementWeightModeFilter';
import { toKg } from './weightUnits';

/** One logged set of a movement that practises a skill node, weights resolved. */
export interface LoadedMovementLog {
  /** `movements.skill_node_id` — which node this movement practises. */
  skillNodeId: string;
  catalogWeightFields: MovementWeightModeFields;
  weightOneUnit: WeightUnit | null;
  weightOneValue: number | null;
  weightTwoUnit: WeightUnit | null;
  weightTwoValue: number | null;
  startedAt: Date;
}

export const bellFromWeight = (
  value: number | null,
  unit: string | null,
): BellKg | null =>
  value === null || value <= 0 ? null : snapToBell(toKg(value, unit));

/**
 * The bell a log actually put in one hand. Double work reports the lighter of
 * the two bells: a mixed pair is only as strong as its weaker side.
 */
const bellForLog = (log: LoadedMovementLog): BellKg | null => {
  const mode = getWeightTabValue(log);
  if (!movementMatchesWeightMode(log.catalogWeightFields, mode)) return null;

  if (mode === '2h' || mode === '1h') {
    return bellFromWeight(log.weightOneValue, log.weightOneUnit);
  }

  if (mode === 'double') {
    if (log.weightOneValue === null || log.weightTwoValue === null) return null;
    const lighter =
      toKg(log.weightOneValue, log.weightOneUnit) <=
      toKg(log.weightTwoValue, log.weightTwoUnit)
        ? { value: log.weightOneValue, unit: log.weightOneUnit }
        : { value: log.weightTwoValue, unit: log.weightTwoUnit };
    return bellFromWeight(lighter.value, lighter.unit);
  }

  return null;
};

/**
 * The heaviest bell each node has been logged at, keyed by node id. A log only
 * counts when the way it was weighted matches the catalog's hand mode for the
 * movement, so a bodyweight goblet squat or a two-bell log of a one-bell
 * movement is ignored rather than read as an edge.
 */
export const deriveSkillNodeLoadEdges = (
  logs: readonly LoadedMovementLog[],
): Map<string, LoadEdge> => {
  const edges = new Map<string, LoadEdge>();

  for (const log of logs) {
    const bell = bellForLog(log);
    if (bell === null) continue;

    const edge = edges.get(log.skillNodeId);
    if (edge === undefined || edge.edgeKg === null || bell > edge.edgeKg) {
      edges.set(log.skillNodeId, { edgeKg: bell, reachedAt: log.startedAt });
    } else if (
      bell === edge.edgeKg &&
      (edge.reachedAt === null || log.startedAt < edge.reachedAt)
    ) {
      edges.set(log.skillNodeId, { edgeKg: bell, reachedAt: log.startedAt });
    }
  }

  return edges;
};
