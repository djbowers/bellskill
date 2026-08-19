// Modality Debt scoring model. Same shape and math as pattern debt but over
// training modalities (grind / ballistic / conditioning / mobility) via the
// catalog's modality_credits. Attribution happens here — the SQL layer stays a
// pure aggregation. Unlike patterns there is NO name-based fallback: unlinked
// custom movements simply pay no modality credit.
//
// Pure + deterministic; reuses the scoring primitives exported by
// patternDebt.ts. See docs/modality-debt-scoring-model.md.

import { daysBetweenCalendarDays } from './dateOnly.ts';
import {
  BALANCE_SPREAD,
  DebtBand,
  EMPTY_TRACKS,
  MovementAggregate,
  PatternRpe,
  RPE_SEVERITY,
  WorkTracks,
  accumulateTracks,
  classifyBand,
  computeDebtScore,
} from './patternDebt.ts';

export const MODALITIES = [
  'grind',
  'ballistic',
  'conditioning',
  'mobility',
] as const;

export type Modality = (typeof MODALITIES)[number];

export type OverallModalityBalance = 'balanced' | `${Modality}-heavy`;

/** Scored, display-ready view of a single modality. */
export interface ModalityDebt {
  modality: Modality;
  lastTrained: Date | null;
  daysSinceLastTrained: number | null;
  recentVolume: number;
  baselineVolume: number | null;
  /** Bodyweight (unloaded-rep) and timed (seconds) work tracks. */
  tracks: WorkTracks;
  debtScore: number;
  band: DebtBand;
  hardestRpe: PatternRpe | null;
  /** No history in the baseline window — neutral "New" state, excluded from spread. */
  isNew: boolean;
}

export interface ModalityBalance {
  modalities: Record<Modality, ModalityDebt>;
  overallBalance: OverallModalityBalance;
}

/**
 * Which modalities a logged movement pays credit toward (boolean, equal, full
 * credit each). Only catalog-linked rows carry credits; unlinked custom
 * movements are unattributed.
 */
export const attributeMovementModality = (
  modalityCredits: string[] | null | undefined,
): Modality[] => [
  ...new Set(
    (modalityCredits ?? []).filter((c): c is Modality =>
      (MODALITIES as readonly string[]).includes(c),
    ),
  ),
];

interface ModalityAccumulator {
  lastTrained: Date | null;
  recentVolume: number;
  baselineVolume: number | null;
  tracks: WorkTracks;
  hardestRpe: PatternRpe | null;
  hasHistory: boolean;
}

const emptyAccumulator = (): ModalityAccumulator => ({
  lastTrained: null,
  recentVolume: 0,
  baselineVolume: null,
  tracks: { ...EMPTY_TRACKS },
  hardestRpe: null,
  hasHistory: false,
});

const scoreModality = (
  modality: Modality,
  acc: ModalityAccumulator,
  now: Date,
): ModalityDebt => {
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
    modality,
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

export const computeOverallModalityBalance = (
  scored: ModalityDebt[],
): OverallModalityBalance => {
  const active = scored.filter((m) => !m.isNew);
  if (active.length === 0) return 'balanced';
  const scores = active.map((m) => m.debtScore);
  if (Math.max(...scores) - Math.min(...scores) < BALANCE_SPREAD)
    return 'balanced';
  // The least-overdue modality is the one the user is skewed toward.
  const dominant = active.reduce((a, b) => (b.debtScore < a.debtScore ? b : a));
  return `${dominant.modality}-heavy`;
};

/**
 * Turn the raw per-movement aggregate rows into the scored modality-balance
 * contract: attribute each movement to its credited modalities, sum window +
 * baseline aggregates per modality, then score. Modalities without any
 * contributing rows come back `isNew` (grace state) rather than red.
 */
export const computeModalityBalance = (
  aggregates: MovementAggregate[],
  now: Date = new Date(),
): ModalityBalance => {
  const accumulators = new Map<Modality, ModalityAccumulator>(
    MODALITIES.map((m) => [m, emptyAccumulator()]),
  );

  for (const row of aggregates) {
    const credited = attributeMovementModality(row.modality_credits);
    for (const modality of credited) {
      const acc = accumulators.get(modality)!;
      acc.hasHistory = true;
      if (row.last_trained_at) {
        const trained = new Date(row.last_trained_at);
        if (!acc.lastTrained || trained > acc.lastTrained)
          acc.lastTrained = trained;
      }
      acc.recentVolume += row.total_volume_kg;
      if (row.baseline_volume_kg != null)
        acc.baselineVolume = (acc.baselineVolume ?? 0) + row.baseline_volume_kg;
      accumulateTracks(acc.tracks, row);
      if (
        row.hardest_rpe &&
        (!acc.hardestRpe ||
          RPE_SEVERITY[row.hardest_rpe] > RPE_SEVERITY[acc.hardestRpe])
      )
        acc.hardestRpe = row.hardest_rpe;
    }
  }

  const scored = MODALITIES.map((modality) =>
    scoreModality(modality, accumulators.get(modality)!, now),
  );

  const modalities = scored.reduce(
    (acc, m) => {
      acc[m.modality] = m;
      return acc;
    },
    {} as Record<Modality, ModalityDebt>,
  );

  return { modalities, overallBalance: computeOverallModalityBalance(scored) };
};
