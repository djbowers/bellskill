import { PatternAggregate, Pattern, computePatternBalance } from '~/utils';

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
): PatternAggregate => ({
  pattern,
  last_trained_at: daysSince === null ? null : daysAgo(daysSince),
  set_count: volume > 0 ? 9 : 0,
  total_reps: volume > 0 ? 45 : 0,
  total_volume_kg: volume,
  baseline_volume_kg: baseline,
});

const balanced = computePatternBalance([
  agg('hinge', 2, 1000, 1000),
  agg('squat', 3, 900, 1000),
  agg('push', 2, 950, 1000),
  agg('pull', 4, 850, 1000),
  agg('carry', 3, 700, 800),
  agg('rotation', 5, 300, 350),
  agg('get_up', 4, 200, 220),
]);

const hingeHeavy = computePatternBalance([
  agg('hinge', 1, 1800, 1000),
  agg('squat', 9, 400, 1000),
  agg('push', 11, 200, 1000),
  agg('pull', 13, 150, 1000),
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
