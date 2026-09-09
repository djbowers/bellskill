import { formatBell } from '~/utils';

import { DerivedLoad } from './deriveNodeStates';

/**
 * "24kg → 28kg" while there is a rung left to climb, "32kg" once at the target,
 * and null before any bell has been logged — a node you have never loaded says
 * more by keeping its Ready/Locked label than by showing an empty ladder.
 */
export const formatLoadEdge = (load: DerivedLoad): string | null => {
  if (load.edgeKg === null) return null;
  const edge = formatBell(load.edgeKg);
  return load.nextKg === null ? edge : `${edge} → ${formatBell(load.nextKg)}`;
};
