import { ValueRange, WeightUnit } from '~/types';

export const getWeightUnitLabel = (unit: WeightUnit | null) => {
  if (unit === 'kilograms') return 'kg';
  if (unit === 'pounds') return 'lb';
  return '';
};

export const getWeightRange = (unit: WeightUnit | null): ValueRange =>
  unit === 'pounds'
    ? { min: 1, max: 220, step: 1 }
    : { min: 1, max: 100, step: 1 };
