import { DateTime } from 'luxon';

import { Modality, ModalityBalance, ModalityDebt } from '~/utils';

export {
  BAND_BAR_CLASS,
  BAND_LABEL,
  MIN_WORKOUTS_FOR_BALANCE,
  RPE_DOT_CLASS,
  RPE_DOT_LABEL,
  formatVolume,
} from '../WeeklyBalance/patternDisplay';

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

/**
 * Rows ordered by what needs work: most-neglected (highest debt) first. New
 * (grace-state) modalities are reinserted at their MODALITY_ORDER index,
 * clamped to the list length, so they read as "here, unstarted" rather than
 * "most overdue" — same rule as the pattern card.
 */
export const modalitiesByNeglect = (balance: ModalityBalance): ModalityDebt[] => {
  const scored = MODALITY_ORDER.map((modality) => balance.modalities[modality]);
  const ranked = scored
    .filter((debt) => !debt.isNew)
    .sort(
      (a, b) =>
        b.debtScore - a.debtScore ||
        MODALITY_ORDER.indexOf(a.modality) - MODALITY_ORDER.indexOf(b.modality),
    );

  const result = [...ranked];
  for (const debt of scored) {
    if (!debt.isNew) continue;
    const index = Math.min(MODALITY_ORDER.indexOf(debt.modality), result.length);
    result.splice(index, 0, debt);
  }
  return result;
};

/** The card's thesis: name the modality most in need, or confirm all-clear. */
export const nextFocusLabel = (balance: ModalityBalance): string => {
  const [top] = modalitiesByNeglect(balance).filter((debt) => !debt.isNew);
  if (!top || top.band === 'green') return "You're on track";
  return `${MODALITY_LABELS[top.modality]} needs work`;
};

/** Compact days-since-trained for the row's right rail; em dash when idle. */
export const recencyShort = (debt: ModalityDebt): string => {
  if (debt.daysSinceLastTrained == null) return '—';
  const days = Math.round(debt.daysSinceLastTrained);
  return days <= 0 ? 'today' : `${days}d`;
};

export const lastTrainedLabel = (lastTrained: Date | null): string => {
  if (!lastTrained) return 'Not trained recently';
  return DateTime.fromJSDate(lastTrained).toRelative() ?? 'Recently';
};
