import { DateTime } from 'luxon';

import {
  DebtBand,
  Modality,
  ModalityBalance,
  ModalityDebt,
  Pattern,
  PatternBalance,
  PatternDebt,
  PatternRpe,
} from '~/utils';

/** Free users need a little history before a balance read is meaningful. */
export const MIN_WORKOUTS_FOR_BALANCE = 3;

/** Display order, roughly grippy-to-grindy. */
export const PATTERN_ORDER: Pattern[] = [
  'hinge',
  'squat',
  'push',
  'pull',
  'carry',
  'rotation',
  'core',
  'get_up',
];

export const PATTERN_LABELS: Record<Pattern, string> = {
  hinge: 'Hinge',
  squat: 'Squat',
  push: 'Push',
  pull: 'Pull',
  carry: 'Carry',
  rotation: 'Rotation',
  core: 'Core',
  get_up: 'Get-up',
};

/** Display order, heavy-to-flowy. */
export const MODALITY_ORDER: Modality[] = [
  'grind',
  'ballistic',
  'conditioning',
  'mobility',
];

export const MODALITY_LABELS: Record<Modality, string> = {
  grind: 'Grind',
  ballistic: 'Ballistic',
  conditioning: 'Cardio',
  mobility: 'Mobility',
};

// Reuse the RPE exertion ramp so the debt bars read as one scale with the
// History week strip: on-track green, due amber, overdue red.
export const BAND_BAR_CLASS: Record<DebtBand, string> = {
  green: 'bg-intensity-1',
  yellow: 'bg-intensity-2',
  red: 'bg-intensity-4',
};

export const BAND_LABEL: Record<DebtBand, string> = {
  green: 'On track',
  yellow: 'Due',
  red: 'Overdue',
};

// The row's exertion dot rides the same RPE intensity ramp as the History week
// strip, so "how hard" reads consistently across the page.
export const RPE_DOT_CLASS: Record<PatternRpe, string> = {
  noEffort: 'bg-intensity-0',
  easy: 'bg-intensity-1',
  ideal: 'bg-intensity-2',
  hard: 'bg-intensity-3',
  maxEffort: 'bg-intensity-4',
};

export const RPE_DOT_LABEL: Record<PatternRpe, string> = {
  noEffort: 'No effort',
  easy: 'Easy',
  ideal: 'Ideal',
  hard: 'Hard',
  maxEffort: 'Max effort',
};

/**
 * Axis-agnostic view of one scored row: PatternDebt and ModalityDebt share
 * every scored field, so the card renders both through this one shape.
 */
export interface BalanceRowModel {
  id: string;
  label: string;
  lastTrained: Date | null;
  daysSinceLastTrained: number | null;
  recentVolume: number;
  baselineVolume: number | null;
  debtScore: number;
  band: DebtBand;
  hardestRpe: PatternRpe | null;
  isNew: boolean;
}

/**
 * Rows ordered by what needs work: most-neglected (highest debt) first, so
 * what to train next sits on top. New (grace-state) rows are visible but not
 * alarm-ranked — each is reinserted at its canonical-order index, clamped to
 * the list length, so it reads as "here, unstarted" rather than "most overdue."
 */
const byNeglect = (scored: BalanceRowModel[]): BalanceRowModel[] => {
  const order = scored.map((row) => row.id);
  const ranked = scored
    .filter((row) => !row.isNew)
    .sort(
      (a, b) =>
        b.debtScore - a.debtScore || order.indexOf(a.id) - order.indexOf(b.id),
    );

  const result = [...ranked];
  for (const row of scored) {
    if (!row.isNew) continue;
    const index = Math.min(order.indexOf(row.id), result.length);
    result.splice(index, 0, row);
  }
  return result;
};

export const patternRows = (balance: PatternBalance): BalanceRowModel[] =>
  byNeglect(
    PATTERN_ORDER.map((pattern) => toRow(balance.patterns[pattern], pattern)),
  );

export const modalityRows = (balance: ModalityBalance): BalanceRowModel[] =>
  byNeglect(
    MODALITY_ORDER.map((modality) =>
      toRow(balance.modalities[modality], modality),
    ),
  );

const toRow = (
  debt: PatternDebt | ModalityDebt,
  id: Pattern | Modality,
): BalanceRowModel => ({
  id,
  label:
    id in PATTERN_LABELS
      ? PATTERN_LABELS[id as Pattern]
      : MODALITY_LABELS[id as Modality],
  lastTrained: debt.lastTrained,
  daysSinceLastTrained: debt.daysSinceLastTrained,
  recentVolume: debt.recentVolume,
  baselineVolume: debt.baselineVolume,
  debtScore: debt.debtScore,
  band: debt.band,
  hardestRpe: debt.hardestRpe,
  isNew: debt.isNew,
});

/** The card's thesis: name the row most in need, or confirm all-clear. */
export const nextFocusLabel = (rows: BalanceRowModel[]): string => {
  const [top] = rows.filter((row) => !row.isNew);
  if (!top || top.band === 'green') return "You're on track";
  return `${top.label} needs work`;
};

/** Compact days-since-trained for the row's right rail; em dash when idle. */
export const recencyShort = (row: BalanceRowModel): string => {
  if (row.daysSinceLastTrained == null) return '—';
  const days = Math.round(row.daysSinceLastTrained);
  return days <= 0 ? 'today' : `${days}d`;
};

export const lastTrainedLabel = (lastTrained: Date | null): string => {
  if (!lastTrained) return 'Not trained recently';
  return DateTime.fromJSDate(lastTrained).toRelative() ?? 'Recently';
};

export { formatVolume } from '~/utils';
