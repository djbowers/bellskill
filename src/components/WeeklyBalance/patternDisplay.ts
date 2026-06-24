import { DateTime } from 'luxon';

import { DebtBand, OverallBalance, Pattern } from '~/utils';

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
  'get_up',
];

export const PATTERN_LABELS: Record<Pattern, string> = {
  hinge: 'Hinge',
  squat: 'Squat',
  push: 'Push',
  pull: 'Pull',
  carry: 'Carry',
  rotation: 'Rotation',
  get_up: 'Get-up',
};

export const BAND_BAR_CLASS: Record<DebtBand, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
};

export const BAND_TEXT_CLASS: Record<DebtBand, string> = {
  green: 'text-green-600',
  yellow: 'text-yellow-600',
  red: 'text-red-600',
};

export const BAND_LABEL: Record<DebtBand, string> = {
  green: 'On track',
  yellow: 'Due',
  red: 'Overdue',
};

export const overallBalanceLabel = (balance: OverallBalance): string => {
  if (balance === 'balanced') return 'Well balanced';
  const pattern = balance.replace('-heavy', '') as Pattern;
  return `${PATTERN_LABELS[pattern]}-heavy`;
};

export const lastTrainedLabel = (lastTrained: Date | null): string => {
  if (!lastTrained) return 'Not trained recently';
  return DateTime.fromJSDate(lastTrained).toRelative() ?? 'Recently';
};

export const formatVolume = (kg: number): string =>
  `${Math.round(kg).toLocaleString()} kg`;
