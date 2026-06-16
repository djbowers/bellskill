import { WeightUnit } from '~/types';
import { getWeightUnitLabel } from '~/utils';

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

export const getRepSchemeDisplayValue = (
  repScheme: number[],
  weights: [number | null, number | null],
) =>
  repScheme.reduce((reps, rung) => {
    const unilateral = (weights[0] ?? 0) > 0 && weights[1] === 0;
    const rungDisplayValue = unilateral ? `${rung} / ${rung}` : rung.toString();
    if (reps === '') return rungDisplayValue;
    return reps + ', ' + rungDisplayValue;
  }, '');
