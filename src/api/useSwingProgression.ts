import { useQuery } from 'react-query';

import { QUERIES } from '~/constants';
import { useSession } from '~/contexts';
import {
  SwingNodeState,
  SwingProgressionData,
  SwingProgressionNode,
  SwingVariation,
} from '~/types';

import { supabase } from '../supabaseClient';

const SWING_WEIGHT_TIERS = [16, 20, 24, 28, 32] as const;

const SWING_THRESHOLDS = { reps: 300, workouts: 10 };

// Canonical names as stored in movement_logs.movement_name.
// "Dead Stop Swing" and "Double Kettlebell Swing" should be verified against
// the live movements catalog before first use.
const SWING_VARIATION_NAMES: Record<SwingVariation, string> = {
  '2h': 'Kettlebell Swing',
  '1h': 'Single Arm Swing',
  'dead-stop': 'Dead Stop Swing',
  double: 'Double Kettlebell Swing',
};

export const useSwingProgression = () => {
  const session = useSession();
  const userId = session?.user?.id;

  return useQuery(
    [QUERIES.SWING_PROGRESSION, userId],
    () => fetchSwingProgression(userId!),
    { enabled: !!userId },
  );
};

export const fetchSwingProgression = async (
  userId: string,
): Promise<SwingProgressionData> => {
  const { data: rows, error } = await supabase
    .from('movement_logs')
    .select(
      'movement_name, rep_scheme, weight_one_value, weight_one_unit, workout_log_id',
    )
    .eq('user_id', userId)
    .in('movement_name', Object.values(SWING_VARIATION_NAMES));

  if (error) {
    console.error(error);
    throw error;
  }

  return deriveProgressionData(rows ?? []);
};

type RawRow = {
  movement_name: string;
  rep_scheme: number[];
  weight_one_value: number | null;
  weight_one_unit: 'kilograms' | 'pounds' | null;
  workout_log_id: number;
};

export const deriveProgressionData = (rows: RawRow[]): SwingProgressionData => {
  const nameToVariation = Object.fromEntries(
    (Object.entries(SWING_VARIATION_NAMES) as [SwingVariation, string][]).map(
      ([variation, name]) => [name, variation],
    ),
  );

  type Bucket = { reps: number; workoutIds: Set<number> };
  const buckets = new Map<string, Bucket>();

  for (const row of rows) {
    const variation = nameToVariation[row.movement_name];
    if (!variation) continue;

    const weightKg = toKg(row.weight_one_value, row.weight_one_unit);
    if (weightKg === null) continue;

    const key = `${variation}-${weightKg}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { reps: 0, workoutIds: new Set() };
      buckets.set(key, bucket);
    }

    bucket.reps += row.rep_scheme.reduce((sum, r) => sum + r, 0);
    bucket.workoutIds.add(row.workout_log_id);
  }

  const nodes: SwingProgressionNode[] = [];

  for (const variation of Object.keys(SWING_VARIATION_NAMES) as SwingVariation[]) {
    let currentWeightKg: number | null = null;

    for (const weightKg of SWING_WEIGHT_TIERS) {
      const bucket = buckets.get(`${variation}-${weightKg}`);
      const totalReps = bucket?.reps ?? 0;
      const totalWorkouts = bucket?.workoutIds.size ?? 0;

      let state: SwingNodeState;
      if (
        totalReps >= SWING_THRESHOLDS.reps &&
        totalWorkouts >= SWING_THRESHOLDS.workouts
      ) {
        state = 'done';
      } else if (currentWeightKg === null) {
        state = 'current';
        currentWeightKg = weightKg;
      } else if (weightKg === nextTier(currentWeightKg)) {
        state = 'next';
      } else {
        state = 'locked';
      }

      nodes.push({ variation, weightKg, totalReps, totalWorkouts, state });
    }
  }

  return nodes;
};

const toKg = (
  value: number | null,
  unit: 'kilograms' | 'pounds' | null,
): number | null => {
  if (value === null || unit === null) return null;
  if (unit === 'kilograms') return value;
  return Math.round(value * 0.453592);
};

const nextTier = (weightKg: number): number | undefined => {
  const idx = SWING_WEIGHT_TIERS.indexOf(weightKg as (typeof SWING_WEIGHT_TIERS)[number]);
  return idx !== -1 ? SWING_WEIGHT_TIERS[idx + 1] : undefined;
};
