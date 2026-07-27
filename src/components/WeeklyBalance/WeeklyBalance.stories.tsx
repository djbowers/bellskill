import {
  PatternAggregate,
  Pattern,
  PatternRpe,
  computePatternBalance,
} from '~/utils';

import { WeeklyBalance } from './WeeklyBalance';

export default {
  component: WeeklyBalance,
};

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

const agg = (
  pattern: Pattern,
  daysSince: number | null,
  volume: number,
  baseline: number | null,
  rpe: PatternRpe | null = null,
): PatternAggregate => ({
  pattern,
  last_trained_at: daysSince === null ? null : daysAgo(daysSince),
  set_count: volume > 0 ? 9 : 0,
  total_reps: volume > 0 ? 45 : 0,
  total_volume_kg: volume,
  baseline_volume_kg: baseline,
  hardest_rpe: rpe,
});

const balanced = computePatternBalance([
  agg('hinge', 2, 1000, 1000, 'hard'),
  agg('squat', 3, 900, 1000, 'ideal'),
  agg('push', 2, 950, 1000, 'maxEffort'),
  agg('pull', 4, 850, 1000, 'easy'),
  agg('carry', 3, 700, 800, 'ideal'),
  agg('rotation', 5, 300, 350, 'easy'),
  agg('get_up', 4, 200, 220, 'hard'),
]);

const hingeHeavy = computePatternBalance([
  agg('hinge', 1, 1800, 1000, 'maxEffort'),
  agg('squat', 9, 400, 1000, 'ideal'),
  agg('push', 11, 200, 1000, 'easy'),
  agg('pull', 13, 150, 1000, 'hard'),
  agg('carry', null, 0, 600),
  agg('rotation', null, 0, null),
  agg('get_up', null, 0, null),
]);

export const Balanced = {
  args: { balance: balanced, workoutCount: 12 },
};

export const HingeHeavy = {
  args: { balance: hingeHeavy, workoutCount: 8 },
};

export const ColdStart = {
  args: { balance: balanced, workoutCount: 1 },
};

export const Loading = {
  args: { workoutCount: 0, isLoading: true },
};
