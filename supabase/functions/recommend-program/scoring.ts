// recommend-program: deterministic scoring copied from the app.
//
// SOURCE OF TRUTH: `src/utils/patternDebt.ts` and `src/utils/stackFit.ts`.
// Those modules import `~/types`, which the Deno edge runtime cannot resolve,
// so the pure functions this recommender needs are copied here verbatim (with
// minimal local types). Keep the constants and formulas in sync with the
// source modules and docs/pattern-debt-scoring-model.md.

import { daysBetweenCalendarDays } from '../../../src/utils/dateOnly.ts';

// ---------------------------------------------------------------------------
// Pattern debt (src/utils/patternDebt.ts)
// ---------------------------------------------------------------------------

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

/** One row as returned by the `pattern_debt_window` RPC. */
export interface PatternAggregate {
  pattern: Pattern;
  last_trained_at: string | null;
  set_count: number;
  total_reps: number;
  total_volume_kg: number;
  baseline_volume_kg: number | null;
}

export interface PatternDebtScore {
  pattern: Pattern;
  days_since_last_trained: number | null;
  debt_score: number;
  band: DebtBand;
}

export interface PatternBalanceSummary {
  patterns: PatternDebtScore[];
  overall_balance: OverallBalance;
}

const TARGET_OVERDUE_DAYS = 14;
const W_RECENCY = 0.6;
const W_VOLUME = 0.4;
const BAND_YELLOW = 33;
const BAND_RED = 66;
const BALANCE_SPREAD = 25;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

const classifyBand = (debtScore: number): DebtBand => {
  if (debtScore >= BAND_RED) return 'red';
  if (debtScore >= BAND_YELLOW) return 'yellow';
  return 'green';
};

const recencyComponent = (daysSince: number | null): number => {
  if (daysSince === null) return 1;
  return clamp01(daysSince / TARGET_OVERDUE_DAYS);
};

const volumeDeficitComponent = (
  recentVolume: number,
  baselineVolume: number | null,
): number => {
  if (baselineVolume === null || baselineVolume <= 0) {
    return recentVolume > 0 ? 0 : 1;
  }
  return clamp01(1 - recentVolume / baselineVolume);
};

const computeDebtScore = (
  daysSince: number | null,
  recentVolume: number,
  baselineVolume: number | null,
): number =>
  Math.round(
    100 *
      (W_RECENCY * recencyComponent(daysSince) +
        W_VOLUME * volumeDeficitComponent(recentVolume, baselineVolume)),
  );

/**
 * Score the seven raw aggregate rows into the compact balance summary the
 * prompt consumes. Missing patterns are backfilled as fully idle (max debt).
 */
export function computePatternBalance(
  aggregates: PatternAggregate[],
  now: Date = new Date(),
): PatternBalanceSummary {
  const byPattern = new Map(aggregates.map((a) => [a.pattern, a]));

  const patterns = PATTERNS.map((pattern): PatternDebtScore => {
    const agg = byPattern.get(pattern) ?? {
      pattern,
      last_trained_at: null,
      set_count: 0,
      total_reps: 0,
      total_volume_kg: 0,
      baseline_volume_kg: null,
    };
    const daysSince = agg.last_trained_at
      ? Math.max(0, daysBetweenCalendarDays(new Date(agg.last_trained_at), now))
      : null;
    const debtScore = computeDebtScore(
      daysSince,
      agg.total_volume_kg,
      agg.baseline_volume_kg,
    );
    return {
      pattern,
      days_since_last_trained:
        daysSince === null ? null : Math.round(daysSince),
      debt_score: debtScore,
      band: classifyBand(debtScore),
    };
  });

  const scores = patterns.map((p) => p.debt_score);
  const spread = Math.max(...scores) - Math.min(...scores);
  const dominant = patterns.reduce((a, b) =>
    b.debt_score < a.debt_score ? b : a,
  );
  const overall_balance: OverallBalance =
    spread < BALANCE_SPREAD ? 'balanced' : `${dominant.pattern}-heavy`;

  return { patterns, overall_balance };
}

// ---------------------------------------------------------------------------
// Stack fit (src/utils/stackFit.ts)
// ---------------------------------------------------------------------------

export type ProgramSystemicDemand = 'low' | 'moderate' | 'high';

export type StackVerdict = 'good' | 'caution' | 'conflict';

/** The slice of a program the stack-fit model reads. */
export interface StackProgram {
  title: string;
  focusTags: string[];
  systemicDemand: ProgramSystemicDemand | null;
}

export interface StackFit {
  verdict: StackVerdict;
  load: number;
  reasons: string[];
}

const DEMAND_COST: Record<ProgramSystemicDemand, number> = {
  low: 1,
  moderate: 2,
  high: 3,
};

const STACK_BUDGET = 5;
const CAUTION_LOAD = 4;
const REDUNDANT_TAG_OVERLAP = 2;

const demandCost = (program: StackProgram): number =>
  program.systemicDemand ? DEMAND_COST[program.systemicDemand] : 0;

const sharedTags = (a: StackProgram, b: StackProgram): string[] =>
  a.focusTags.filter((tag) => b.focusTags.includes(tag));

const listNames = (names: string[]): string => {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
};

/**
 * Assess adding `candidate` on top of the programs already running. Returns
 * `null` when there is nothing to say (no active programs, or an unrated
 * candidate).
 */
export function assessStackFit(
  candidate: StackProgram,
  active: StackProgram[],
): StackFit | null {
  if (active.length === 0) return null;
  if (!candidate.systemicDemand && candidate.focusTags.length === 0)
    return null;

  const load =
    demandCost(candidate) + active.reduce((sum, p) => sum + demandCost(p), 0);
  const reasons: string[] = [];

  const fullyRated =
    !!candidate.systemicDemand && active.every((p) => !!p.systemicDemand);
  const overBudget = fullyRated && load > STACK_BUDGET;

  if (overBudget) {
    reasons.push(
      `This is more hard training than most people recover from at once. ${candidate.title} is ${candidate.systemicDemand} demand on top of ${listNames(active.map((p) => p.title))}.`,
    );
  } else if (fullyRated && load >= CAUTION_LOAD) {
    reasons.push(
      `This fills your recovery budget. It works if the rest of your week is easy, but there's no room left for a third.`,
    );
  }

  const redundant = active.filter(
    (p) => sharedTags(candidate, p).length >= REDUNDANT_TAG_OVERLAP,
  );
  if (redundant.length > 0) {
    const overlap = sharedTags(candidate, redundant[0]);
    reasons.push(
      `${listNames(redundant.map((p) => p.title))} already covers ${listNames(overlap)}. You'd be training the same qualities twice.`,
    );
  }

  if (overBudget) return { verdict: 'conflict', load, reasons };
  if (reasons.length > 0) return { verdict: 'caution', load, reasons };
  return { verdict: 'good', load, reasons };
}
