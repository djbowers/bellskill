// Pattern Debt scoring model (PROD-155). Single source of truth for turning the
// raw per-movement aggregates returned by the `pattern_debt_movements` SQL
// function into debt scores, color bands, and an overall balance classification.
// ALL pattern attribution (credit fan-out, get-up name regex, unlinked-movement
// policy) happens here — the SQL layer is a pure aggregation.
//
// Pure + deterministic so it can be unit-tested here and reused verbatim by the
// recommender edge functions. See docs/pattern-debt-scoring-model.md.

import { daysBetweenCalendarDays } from './dateOnly.ts';

export const PATTERNS = [
  'hinge',
  'squat',
  'push',
  'pull',
  'carry',
  'rotation',
  'core',
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

export const RPE_SEVERITY: Record<PatternRpe, number> = {
  noEffort: 0,
  easy: 1,
  ideal: 2,
  hard: 3,
  maxEffort: 4,
};

/** One row as returned by the `pattern_debt_movements` RPC. */
export interface MovementAggregate {
  movement_id: string | null;
  movement_name: string;
  /** Catalog credits; null when the movement has no catalog link. */
  pattern_credits: string[] | null;
  /** Catalog modality credits; null when unlinked (see modalityDebt.ts). */
  modality_credits?: string[] | null;
  last_trained_at: string | null;
  set_count: number;
  total_reps: number;
  total_volume_kg: number;
  baseline_volume_kg: number | null;
  hardest_rpe?: PatternRpe | null;
  /** Reps from non-timed sets with zero effective load (bodyweight track). */
  total_unloaded_reps?: number;
  baseline_unloaded_reps?: number | null;
  /** Timed-rung seconds under tension (× rounds passes). */
  total_seconds?: number;
  baseline_seconds?: number | null;
}

/** Scored, display-ready view of a single pattern. */
export interface PatternDebt {
  pattern: Pattern;
  lastTrained: Date | null;
  daysSinceLastTrained: number | null;
  recentVolume: number;
  baselineVolume: number | null;
  /** Bodyweight (unloaded-rep) and timed (seconds) work tracks. */
  tracks: WorkTracks;
  debtScore: number;
  band: DebtBand;
  hardestRpe: PatternRpe | null;
  /**
   * No history at all in the baseline window — the pattern renders a neutral
   * "New" state and is excluded from spread/overallBalance until first trained.
   */
  isNew: boolean;
}

export interface PatternBalance {
  patterns: Record<Pattern, PatternDebt>;
  overallBalance: OverallBalance;
}

// Tunable model constants — see the scoring-model doc. TARGET_CADENCE_DAYS is
// the single cadence knob; the saturation point derives from it (X5), and a
// future per-pattern override replaces the scalar with a map.
export const TARGET_CADENCE_DAYS = 7;
export const OVERDUE_DAYS = 2 * TARGET_CADENCE_DAYS;
export const W_RECENCY = 0.6;
export const W_VOLUME = 0.4;
export const BAND_YELLOW = 33;
export const BAND_RED = 66;
export const BALANCE_SPREAD = 25;

const GET_UP_NAME = /get[ -]?up|turkish/i;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export const classifyBand = (debtScore: number): DebtBand => {
  if (debtScore >= BAND_RED) return 'red';
  if (debtScore >= BAND_YELLOW) return 'yellow';
  return 'green';
};

/**
 * Which coarse patterns a logged movement pays credit toward (boolean, equal,
 * full credit each). Catalog-linked rows carry explicit credits; unlinked
 * custom movements fall back to the get-up name regex or are ignored.
 */
export const attributeMovement = (
  patternCredits: string[] | null,
  movementName: string,
): Pattern[] => {
  if (patternCredits && patternCredits.length > 0) {
    return [
      ...new Set(
        patternCredits.filter((c): c is Pattern =>
          (PATTERNS as readonly string[]).includes(c),
        ),
      ),
    ];
  }
  return GET_UP_NAME.test(movementName) ? ['get_up'] : [];
};

const recencyComponent = (daysSince: number | null): number => {
  if (daysSince === null) return 1; // never trained in window -> max recency debt
  return clamp01(daysSince / OVERDUE_DAYS);
};

/**
 * Non-kg work tracks so bodyweight (unloaded reps) and timed work (seconds
 * under tension) pay down volume debt like loaded kilograms do.
 */
export interface WorkTracks {
  recentUnloadedReps: number;
  baselineUnloadedReps: number | null;
  recentSeconds: number;
  baselineSeconds: number | null;
}

export const EMPTY_TRACKS: WorkTracks = {
  recentUnloadedReps: 0,
  baselineUnloadedReps: null,
  recentSeconds: 0,
  baselineSeconds: null,
};

/**
 * Work-deficit across the kg / unloaded-rep / seconds tracks: each track with
 * a positive baseline contributes `1 - recent/baseline`, combined by
 * unweighted mean (units are incomparable). Weighted reps never enter the rep
 * track, so pure-kg users reduce exactly to the original kg-only formula.
 */
const workDeficitComponent = (
  recentVolume: number,
  baselineVolume: number | null,
  tracks: WorkTracks,
): number => {
  const perTrack: number[] = [];
  if (baselineVolume != null && baselineVolume > 0)
    perTrack.push(clamp01(1 - recentVolume / baselineVolume));
  if (tracks.baselineUnloadedReps != null && tracks.baselineUnloadedReps > 0)
    perTrack.push(
      clamp01(1 - tracks.recentUnloadedReps / tracks.baselineUnloadedReps),
    );
  if (tracks.baselineSeconds != null && tracks.baselineSeconds > 0)
    perTrack.push(clamp01(1 - tracks.recentSeconds / tracks.baselineSeconds));

  if (perTrack.length === 0) {
    // No baseline on any track: an active-but-new pattern isn't in debt; an
    // idle one is.
    const anyRecentActivity =
      recentVolume > 0 ||
      tracks.recentUnloadedReps > 0 ||
      tracks.recentSeconds > 0;
    return anyRecentActivity ? 0 : 1;
  }
  return perTrack.reduce((sum, d) => sum + d, 0) / perTrack.length;
};

export const computeDebtScore = (
  daysSince: number | null,
  recentVolume: number,
  baselineVolume: number | null,
  tracks: WorkTracks = EMPTY_TRACKS,
): number => {
  const recency = recencyComponent(daysSince);
  const deficit = workDeficitComponent(recentVolume, baselineVolume, tracks);
  return Math.round(100 * (W_RECENCY * recency + W_VOLUME * deficit));
};

/** Balance-mode coverage cap: the recommender targets at most this many patterns. */
export const BALANCE_TARGET_LIMIT = 3;

/** The fields target selection needs from a scored pattern (camelCase or serialized). */
export interface BalanceTargetPattern {
  pattern: Pattern;
  band: DebtBand;
  debtScore: number;
  isNew: boolean;
}

/**
 * Deterministic target selection for the recommender's balance mode: the
 * highest-debt red-band patterns (non-New) that at least one candidate
 * movement's credits can cover, capped at BALANCE_TARGET_LIMIT. Ties break on
 * canonical PATTERNS order so results are stable.
 */
export const selectBalanceTargets = (
  patterns: BalanceTargetPattern[],
  candidateCredits: Array<readonly string[] | null>,
  limit: number = BALANCE_TARGET_LIMIT,
): Pattern[] => {
  const coverable = new Set<string>();
  for (const credits of candidateCredits) {
    for (const credit of credits ?? []) coverable.add(credit);
  }
  return patterns
    .filter((p) => p.band === 'red' && !p.isNew && coverable.has(p.pattern))
    .sort(
      (a, b) =>
        b.debtScore - a.debtScore ||
        PATTERNS.indexOf(a.pattern) - PATTERNS.indexOf(b.pattern),
    )
    .slice(0, limit)
    .map((p) => p.pattern);
};

interface PatternAccumulator {
  lastTrained: Date | null;
  recentVolume: number;
  baselineVolume: number | null;
  tracks: WorkTracks;
  hardestRpe: PatternRpe | null;
  hasHistory: boolean;
}

const emptyAccumulator = (): PatternAccumulator => ({
  lastTrained: null,
  recentVolume: 0,
  baselineVolume: null,
  tracks: { ...EMPTY_TRACKS },
  hardestRpe: null,
  hasHistory: false,
});

/** Fold one aggregate row's rep/seconds tracks into an accumulator's tracks. */
export const accumulateTracks = (
  tracks: WorkTracks,
  row: MovementAggregate,
): void => {
  tracks.recentUnloadedReps += row.total_unloaded_reps ?? 0;
  if (row.baseline_unloaded_reps != null)
    tracks.baselineUnloadedReps =
      (tracks.baselineUnloadedReps ?? 0) + row.baseline_unloaded_reps;
  tracks.recentSeconds += row.total_seconds ?? 0;
  if (row.baseline_seconds != null)
    tracks.baselineSeconds =
      (tracks.baselineSeconds ?? 0) + row.baseline_seconds;
};

const scorePattern = (
  pattern: Pattern,
  acc: PatternAccumulator,
  now: Date,
): PatternDebt => {
  const daysSinceLastTrained = acc.lastTrained
    ? Math.max(0, daysBetweenCalendarDays(acc.lastTrained, now))
    : null;
  const debtScore = computeDebtScore(
    daysSinceLastTrained,
    acc.recentVolume,
    acc.baselineVolume,
    acc.tracks,
  );

  return {
    pattern,
    lastTrained: acc.lastTrained,
    daysSinceLastTrained,
    recentVolume: acc.recentVolume,
    baselineVolume: acc.baselineVolume,
    tracks: acc.tracks,
    debtScore,
    band: classifyBand(debtScore),
    hardestRpe: acc.hardestRpe,
    isNew: !acc.hasHistory,
  };
};

export const computeOverallBalance = (scored: PatternDebt[]): OverallBalance => {
  const active = scored.filter((p) => !p.isNew);
  if (active.length === 0) return 'balanced';
  const scores = active.map((p) => p.debtScore);
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  if (max - min < BALANCE_SPREAD) return 'balanced';
  // The least-overdue pattern is the one the user is skewed toward.
  const dominant = active.reduce((a, b) => (b.debtScore < a.debtScore ? b : a));
  return `${dominant.pattern}-heavy`;
};

/**
 * Turn the raw per-movement aggregate rows into the full, scored
 * pattern-balance contract: attribute each movement to its credited patterns,
 * sum window + baseline aggregates per pattern, then score. Patterns without
 * any contributing rows come back `isNew` (grace state) rather than red.
 * `enabledPatterns` scopes the result — disabled patterns (Phase 2 per-user
 * preference) are omitted from both the record and the overall balance.
 */
export const computePatternBalance = (
  aggregates: MovementAggregate[],
  now: Date = new Date(),
  enabledPatterns: readonly Pattern[] = PATTERNS,
): PatternBalance => {
  const accumulators = new Map<Pattern, PatternAccumulator>(
    enabledPatterns.map((p) => [p, emptyAccumulator()]),
  );

  for (const row of aggregates) {
    const credited = attributeMovement(row.pattern_credits, row.movement_name);
    for (const pattern of credited) {
      const acc = accumulators.get(pattern);
      if (!acc) continue; // disabled pattern
      acc.hasHistory = true;
      if (row.last_trained_at) {
        const trained = new Date(row.last_trained_at);
        if (!acc.lastTrained || trained > acc.lastTrained)
          acc.lastTrained = trained;
      }
      acc.recentVolume += row.total_volume_kg;
      if (row.baseline_volume_kg != null)
        acc.baselineVolume =
          (acc.baselineVolume ?? 0) + row.baseline_volume_kg;
      accumulateTracks(acc.tracks, row);
      if (
        row.hardest_rpe &&
        (!acc.hardestRpe ||
          RPE_SEVERITY[row.hardest_rpe] > RPE_SEVERITY[acc.hardestRpe])
      )
        acc.hardestRpe = row.hardest_rpe;
    }
  }

  const scored = enabledPatterns.map((pattern) =>
    scorePattern(pattern, accumulators.get(pattern)!, now),
  );

  const patterns = scored.reduce(
    (acc, p) => {
      acc[p.pattern] = p;
      return acc;
    },
    {} as Record<Pattern, PatternDebt>,
  );

  return { patterns, overallBalance: computeOverallBalance(scored) };
};
