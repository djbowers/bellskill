import { useQuery } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { useSession } from '~/contexts';
import { WeightUnit } from '~/types';
import {
  LoadedMovementLog,
  MovementWeightModeFields,
  toWorkoutMode,
  usesSharedBell,
} from '~/utils';

import { supabase } from '../supabaseClient';

interface CatalogRow {
  id: string;
  Movement: string;
  skill_node_id: string | null;
  'Primary Equipment': string | null;
  '# Primary Items': number | null;
  'Single or Double Arm': string | null;
}

interface WorkoutRow {
  started_at: string;
  complex_set: boolean | null;
  shared_bell: boolean | null;
  shared_weight_one_unit: WeightUnit | null;
  shared_weight_one_value: number | null;
  shared_weight_two_unit: WeightUnit | null;
  shared_weight_two_value: number | null;
}

interface LogRow {
  weight_one_unit: WeightUnit | null;
  weight_one_value: number | null;
  weight_two_unit: WeightUnit | null;
  weight_two_value: number | null;
  user_movements:
    | { functional_movement_id: string | null }
    | { functional_movement_id: string | null }[];
  workout_logs: WorkoutRow | WorkoutRow[];
}

/** Logs plus the movement names behind each node, for the dialog's "Counts" line. */
export interface SkillNodeLoadLogs {
  logs: LoadedMovementLog[];
  movementsByNodeId: Map<string, string[]>;
}

const first = <T,>(value: T | T[]): T | undefined =>
  Array.isArray(value) ? value[0] : value;

const toCatalogWeightFields = (row: CatalogRow): MovementWeightModeFields => ({
  primaryEquipment: row['Primary Equipment'],
  primaryItemCount: row['# Primary Items'],
  singleOrDoubleArm: row['Single or Double Arm'],
});

/**
 * The weights a log was actually performed at. A complex or shared-bell workout
 * holds the real load on the parent, but legacy rows carry no shared weight at
 * all, so the movement's own weights stand in — the same fallback the pattern
 * debt aggregate makes in SQL.
 */
const effectiveWeights = (row: LogRow, workout: WorkoutRow) => {
  const shared =
    usesSharedBell({
      workoutMode: toWorkoutMode(workout.complex_set),
      sharedBell: workout.shared_bell,
    }) && workout.shared_weight_one_value !== null;

  return shared
    ? {
        weightOneUnit: workout.shared_weight_one_unit,
        weightOneValue: workout.shared_weight_one_value,
        weightTwoUnit: workout.shared_weight_two_unit,
        weightTwoValue: workout.shared_weight_two_value,
      }
    : {
        weightOneUnit: row.weight_one_unit,
        weightOneValue: row.weight_one_value,
        weightTwoUnit: row.weight_two_unit,
        weightTwoValue: row.weight_two_value,
      };
};

/**
 * Every logged set of a movement that practises a skill tree node, resolved to
 * the bell it was actually performed at. Logs never linked to a catalog movement
 * are excluded by the join — they carry no movement identity to attribute.
 */
export const useSkillNodeLoadLogs = () => {
  const session = useSession();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: [QUERIES.SKILL_NODE_LOAD_LOGS, userId],
    queryFn: fetchSkillNodeLoadLogs,
    enabled: !!userId,
  });
};

const EMPTY: SkillNodeLoadLogs = { logs: [], movementsByNodeId: new Map() };

const fetchSkillNodeLoadLogs = async (): Promise<SkillNodeLoadLogs> => {
  const { data: catalog, error: catalogError } = await supabase
    .from('movements')
    .select('*')
    .not('skill_node_id', 'is', null);

  if (catalogError) {
    console.error(catalogError);
    throw catalogError;
  }

  const catalogById = new Map(
    ((catalog ?? []) as CatalogRow[]).map((row) => [row.id, row]),
  );
  // PostgREST rejects an empty `in.()`, and with no mapped movement there is
  // nothing any node could count anyway.
  if (catalogById.size === 0) return EMPTY;

  const movementsByNodeId = new Map<string, string[]>();
  for (const row of catalogById.values()) {
    if (!row.skill_node_id) continue;
    const names = movementsByNodeId.get(row.skill_node_id) ?? [];
    names.push(row.Movement);
    movementsByNodeId.set(row.skill_node_id, names);
  }

  const { data: rows, error } = await supabase
    .from('movement_logs')
    .select(
      `weight_one_unit, weight_one_value, weight_two_unit, weight_two_value,
       user_movements!inner(functional_movement_id),
       workout_logs!inner(started_at, complex_set, shared_bell,
         shared_weight_one_unit, shared_weight_one_value,
         shared_weight_two_unit, shared_weight_two_value)`,
    )
    .in('user_movements.functional_movement_id', [...catalogById.keys()]);

  if (error) {
    console.error(error);
    throw error;
  }

  const logs = ((rows ?? []) as unknown as LogRow[]).flatMap((row) => {
    const catalogId = first(row.user_movements)?.functional_movement_id;
    const catalogRow = catalogId ? catalogById.get(catalogId) : undefined;
    const workout = first(row.workout_logs);
    if (!catalogRow?.skill_node_id || !workout) return [];

    return [
      {
        skillNodeId: catalogRow.skill_node_id,
        catalogWeightFields: toCatalogWeightFields(catalogRow),
        startedAt: new Date(workout.started_at),
        ...effectiveWeights(row, workout),
      },
    ];
  });

  return { logs, movementsByNodeId };
};
