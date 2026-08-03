// Pattern Debt scoring model (PROD-155). Single source of truth for turning the
// raw per-pattern aggregates returned by the `pattern_debt_window` SQL function
// into debt scores, color bands, and an overall balance classification.
//
// Pure + deterministic so it can be unit-tested here and reused verbatim by the
// recommender edge function. See docs/pattern-debt-scoring-model.md.

import { daysBetweenCalendarDays } from './dateOnly.ts';

export const PATTERNS = [
  'hinge',
  'squat',
  'push',
  'pull',
  'carry',
  'rotation',
  'get_up',
] as const;

export type Pattern = (typeof PATTERNS)[number];

export type DebtBand = 'green' | 'yellow' | 'red';

export type OverallBalance = 'balanced' | `${Pattern}-heavy`;

/**
 * Session-level exertion rating (`workout_logs.rpe`) inherited onto each pattern
 * a session trained. Informational only — never an input to the debt score.
 * Declared locally so this module stays free of app-path imports for the
 * recommender edge function; mirrors `RpeOptions` in `src/types`.
 */
export type PatternRpe = 'noEffort' | 'easy' | 'ideal' | 'hard' | 'maxEffort';

/** One row as returned by the `pattern_debt_window` RPC. */
export interface PatternAggregate {
  pattern: Pattern;
  last_trained_at: string | null;
  set_count: number;
  total_reps: number;
  total_volume_kg: number;
  baseline_volume_kg: number | null;
  hardest_rpe?: PatternRpe | null;
}

/** Scored, display-ready view of a single pattern. */
export interface PatternDebt {
  pattern: Pattern;
  lastTrained: Date | null;
  daysSinceLastTrained: number | null;
  recentVolume: number;
  baselineVolume: number | null;
  debtScore: number;
  band: DebtBand;
  hardestRpe: PatternRpe | null;
}

export interface PatternBalance {
  patterns: Record<Pattern, PatternDebt>;
  overallBalance: OverallBalance;
}

// Tunable model constants — see the scoring-model doc.
export const TARGET_CADENCE_DAYS = 7;
export const OVERDUE_DAYS = 14;
export const W_RECENCY = 0.6;
export const W_VOLUME = 0.4;
export const BAND_YELLOW = 33;
export const BAND_RED = 66;
export const BALANCE_SPREAD = 25;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export const classifyBand = (debtScore: number): DebtBand => {
  if (debtScore >= BAND_RED) return 'red';
  if (debtScore >= BAND_YELLOW) return 'yellow';
  return 'green';
};

const recencyComponent = (daysSince: number | null): number => {
  if (daysSince === null) return 1; // never trained in window -> max recency debt
  return clamp01(daysSince / OVERDUE_DAYS);
};

const volumeDeficitComponent = (
  recentVolume: number,
  baselineVolume: number | null,
): number => {
  if (baselineVolume === null || baselineVolume <= 0) {
    // No baseline: an active-but-new pattern isn't in debt; an idle one is.
    return recentVolume > 0 ? 0 : 1;
  }
  return clamp01(1 - recentVolume / baselineVolume);
};

export const computeDebtScore = (
  daysSince: number | null,
  recentVolume: number,
  baselineVolume: number | null,
): number => {
  const recency = recencyComponent(daysSince);
  const deficit = volumeDeficitComponent(recentVolume, baselineVolume);
  return Math.round(100 * (W_RECENCY * recency + W_VOLUME * deficit));
};

const scorePattern = (agg: PatternAggregate, now: Date): PatternDebt => {
  const lastTrained = agg.last_trained_at ? new Date(agg.last_trained_at) : null;
  const daysSinceLastTrained = lastTrained
    ? Math.max(0, daysBetweenCalendarDays(lastTrained, now))
    : null;
  const debtScore = computeDebtScore(
    daysSinceLastTrained,
    agg.total_volume_kg,
    agg.baseline_volume_kg,
  );

  return {
    pattern: agg.pattern,
    lastTrained,
    daysSinceLastTrained,
    recentVolume: agg.total_volume_kg,
    baselineVolume: agg.baseline_volume_kg,
    debtScore,
    band: classifyBand(debtScore),
    hardestRpe: agg.hardest_rpe ?? null,
  };
};

export const computeOverallBalance = (
  scored: PatternDebt[],
): OverallBalance => {
  if (scored.length === 0) return 'balanced';
  const scores = scored.map((p) => p.debtScore);
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  if (max - min < BALANCE_SPREAD) return 'balanced';
  // The least-overdue pattern is the one the user is skewed toward.
  const dominant = scored.reduce((a, b) => (b.debtScore < a.debtScore ? b : a));
  return `${dominant.pattern}-heavy`;
};

/**
 * Turn the seven raw aggregate rows into the full, scored pattern-balance
 * contract. Missing patterns are backfilled as fully-idle (max debt) so the
 * result always covers all seven patterns.
 */
export const computePatternBalance = (
  aggregates: PatternAggregate[],
  now: Date = new Date(),
): PatternBalance => {
  const byPattern = new Map(aggregates.map((a) => [a.pattern, a]));

  const scored = PATTERNS.map((pattern) => {
    const agg = byPattern.get(pattern) ?? {
      pattern,
      last_trained_at: null,
      set_count: 0,
      total_reps: 0,
      total_volume_kg: 0,
      baseline_volume_kg: null,
    };
    return scorePattern(agg, now);
  });

  const patterns = scored.reduce(
    (acc, p) => {
      acc[p.pattern] = p;
      return acc;
    },
    {} as Record<Pattern, PatternDebt>,
  );

  return { patterns, overallBalance: computeOverallBalance(scored) };
};
