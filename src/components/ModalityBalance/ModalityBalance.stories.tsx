import {
  Modality,
  MovementAggregate,
  PatternRpe,
  computeModalityBalance,
} from '~/utils';

import { ModalityBalance } from './ModalityBalance';

export default {
  component: ModalityBalance,
};

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

const agg = (
  modalities: Modality[],
  daysSince: number | null,
  volume: number,
  baseline: number | null,
  rpe: PatternRpe | null = null,
): MovementAggregate => ({
  movement_id: `${modalities.join('-')}-movement`,
  movement_name: `${modalities.join('/')} movement`,
  pattern_credits: null,
  modality_credits: modalities,
  last_trained_at: daysSince === null ? null : daysAgo(daysSince),
  set_count: volume > 0 ? 9 : 0,
  total_reps: volume > 0 ? 45 : 0,
  total_volume_kg: volume,
  baseline_volume_kg: baseline,
  hardest_rpe: rpe,
});

const balanced = computeModalityBalance([
  agg(['grind'], 2, 1000, 1000, 'hard'),
  agg(['ballistic', 'conditioning'], 3, 900, 1000, 'ideal'),
  agg(['mobility'], 4, 200, 220, 'easy'),
]);

const grindHeavy = computeModalityBalance([
  agg(['grind'], 1, 1800, 1000, 'maxEffort'),
  agg(['ballistic'], 11, 200, 1000, 'easy'),
  agg(['conditioning'], 13, 150, 1000, 'hard'),
  agg(['mobility'], null, 0, 600),
]);

export const Balanced = {
  args: { balance: balanced, workoutCount: 12 },
};

export const GrindHeavy = {
  args: { balance: grindHeavy, workoutCount: 8 },
};

export const NewUser = {
  args: {
    balance: computeModalityBalance([agg(['grind'], 1, 1000, 1000, 'ideal')]),
    workoutCount: 5,
  },
};

export const ColdStart = {
  args: { balance: balanced, workoutCount: 1 },
};

export const Loading = {
  args: { workoutCount: 0, isLoading: true },
};

export const ErrorState = {
  args: { workoutCount: 0, isError: true, onRetry: () => {} },
};
