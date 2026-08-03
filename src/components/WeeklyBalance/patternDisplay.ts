import { DateTime } from 'luxon';

import {
  DebtBand,
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
 * Rows ordered by what needs work: most-neglected (highest debt) first, so the
 * pattern to train next sits on top. New (grace-state) patterns are visible
 * but not alarm-ranked — rather than sorting into the debt-desc order, each
 * is reinserted at its anatomical (PATTERN_ORDER) index, clamped to the list
 * length, so it reads as "here, unstarted" rather than "most overdue."
 */
export const patternsByNeglect = (balance: PatternBalance): PatternDebt[] => {
  const scored = PATTERN_ORDER.map((pattern) => balance.patterns[pattern]);
  const ranked = scored
    .filter((debt) => !debt.isNew)
    .sort(
      (a, b) =>
        b.debtScore - a.debtScore ||
        PATTERN_ORDER.indexOf(a.pattern) - PATTERN_ORDER.indexOf(b.pattern),
    );

  const result = [...ranked];
  for (const debt of scored) {
    if (!debt.isNew) continue;
    const index = Math.min(PATTERN_ORDER.indexOf(debt.pattern), result.length);
    result.splice(index, 0, debt);
  }
  return result;
};

/** The card's thesis: name the pattern most in need, or confirm all-clear. */
export const nextFocusLabel = (balance: PatternBalance): string => {
  const [top] = patternsByNeglect(balance).filter((debt) => !debt.isNew);
  if (!top || top.band === 'green') return "You're on track";
  return `${PATTERN_LABELS[top.pattern]} needs work`;
};

/** Compact days-since-trained for the row's right rail; em dash when idle. */
export const recencyShort = (debt: PatternDebt): string => {
  if (debt.daysSinceLastTrained == null) return '—';
  const days = Math.round(debt.daysSinceLastTrained);
  return days <= 0 ? 'today' : `${days}d`;
};

export const lastTrainedLabel = (lastTrained: Date | null): string => {
  if (!lastTrained) return 'Not trained recently';
  return DateTime.fromJSDate(lastTrained).toRelative() ?? 'Recently';
};

export { formatVolume } from '~/utils';
