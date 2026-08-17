import {
  Modality,
  MovementAggregate,
  Pattern,
  PatternRpe,
  computeModalityBalance,
  computePatternBalance,
} from '~/utils';

import { TrainingBalance } from './TrainingBalance';

export default {
  component: TrainingBalance,
};

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

const agg = (
  patterns: Pattern[],
  modalities: Modality[],
  daysSince: number | null,
  volume: number,
  baseline: number | null,
  rpe: PatternRpe | null = null,
): MovementAggregate => ({
  movement_id: `${patterns.join('-')}-movement`,
  movement_name: `${patterns.join('/')} movement`,
  pattern_credits: patterns,
  modality_credits: modalities,
  last_trained_at: daysSince === null ? null : daysAgo(daysSince),
  set_count: volume > 0 ? 9 : 0,
  total_reps: volume > 0 ? 45 : 0,
  total_volume_kg: volume,
  baseline_volume_kg: baseline,
  hardest_rpe: rpe,
});

const aggregates = [
  agg(['hinge'], ['ballistic', 'conditioning'], 2, 1000, 1000, 'hard'),
  agg(['squat'], ['grind'], 3, 900, 1000, 'ideal'),
  agg(['push'], ['grind'], 2, 950, 1000, 'maxEffort'),
  agg(['pull'], ['grind'], 4, 850, 1000, 'easy'),
  agg(['carry'], ['grind', 'conditioning'], 3, 700, 800, 'ideal'),
  agg(['rotation'], ['mobility'], 12, 30, 350, 'easy'),
  agg(['core'], ['grind'], 4, 400, 450, 'ideal'),
  agg(['get_up'], ['grind', 'mobility'], 4, 200, 220, 'hard'),
];

export const BothAxes = {
  args: {
    patternBalance: computePatternBalance(aggregates),
    modalityBalance: computeModalityBalance(aggregates),
    workoutCount: 12,
  },
};

export const PatternsOnly = {
  args: {
    patternBalance: computePatternBalance(aggregates),
    showModalities: false,
    workoutCount: 12,
  },
};

export const MixOnly = {
  args: {
    modalityBalance: computeModalityBalance(aggregates),
    showPatterns: false,
    workoutCount: 12,
  },
};

export const ColdStart = {
  args: {
    patternBalance: computePatternBalance(aggregates),
    modalityBalance: computeModalityBalance(aggregates),
    workoutCount: 1,
  },
};

export const Loading = {
  args: { workoutCount: 0, isLoading: true },
};

export const ErrorState = {
  args: { workoutCount: 0, isError: true, onRetry: () => {} },
};
