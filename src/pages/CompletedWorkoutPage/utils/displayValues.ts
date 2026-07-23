import { WeightUnit } from '~/types';
import { formatRungDuration, getWeightUnitLabel } from '~/utils';

export const getWeightsDisplayValue = (
  weightOneValue: number | null,
  weightOneUnit: string | null,
  weightTwoValue: number | null,
  weightTwoUnit: string | null,
) => {
  if (weightOneValue === null && weightTwoValue === null) return 'bw';
  const weightOne = weightOneValue
    ? `${weightOneValue} ${getWeightUnitLabel(weightOneUnit as WeightUnit)}`
    : '';
  const weightTwo = weightTwoValue
    ? `${weightTwoValue} ${getWeightUnitLabel(weightTwoUnit as WeightUnit)}`
    : '';
  const hands =
    weightTwoValue === null ? '(2h)' : weightTwoValue === 0 ? '(1h)' : '';
  return `${weightOne}${weightTwo ? ', ' : ''}${weightTwo}${
    hands ? ' ' : ''
  }${hands}`;
};

/**
 * Render a movement's rungs for the history/completed view. A timed movement's
 * rungs are SECONDS, so they format as durations — "0:05 / 0:05" rather than a
 * bare "5 / 5", which would otherwise read as five reps.
 */
export const getRepSchemeDisplayValue = (
  repScheme: number[],
  weights: [number | null, number | null],
  timedRungs = false,
) =>
  repScheme.reduce((reps, rung) => {
    const unilateral = (weights[0] ?? 0) > 0 && weights[1] === 0;
    const rungValue = timedRungs ? formatRungDuration(rung) : rung.toString();
    const rungDisplayValue = unilateral
      ? `${rungValue} / ${rungValue}`
      : rungValue;
    if (reps === '') return rungDisplayValue;
    return reps + ', ' + rungDisplayValue;
  }, '');
