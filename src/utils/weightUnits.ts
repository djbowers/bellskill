import { ValueRange, WeightUnit } from '~/types';

const POUNDS_TO_KG = 0.45359237;

export const getWeightUnitLabel = (unit: WeightUnit | null) => {
  if (unit === 'kilograms') return 'kg';
  if (unit === 'pounds') return 'lb';
  return '';
};

export const getWeightRange = (unit: WeightUnit | null): ValueRange =>
  unit === 'pounds'
    ? { min: 1, max: 220, step: 1 }
    : { min: 1, max: 100, step: 1 };

/**
 * A logged weight in kilograms, rounded to the half-kilo bells are actually
 * cast in. Without the rounding a 35lb bell reads as 15.88kg and compares as
 * lighter than the 16kg it is.
 */
export const toKg = (value: number, unit: string | null): number => {
  const kg = unit === 'pounds' ? value * POUNDS_TO_KG : value;
  return Math.round(kg * 2) / 2;
};
