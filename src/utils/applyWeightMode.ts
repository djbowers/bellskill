import { WeightTabValue, WeightUnit } from '~/types';

export interface WeightSlots {
  weightOneUnit: WeightUnit | null;
  weightOneValue: number | null;
  weightTwoUnit: WeightUnit | null;
  weightTwoValue: number | null;
}

export interface WeightModeDefaults {
  value: number;
  unit: WeightUnit;
}

/** Re-encode the carried-over weight into the mode's null-pattern:
 *  'none' = both null, '2h' = two null, '1h' = two 0, 'double' = both loaded. */
export const applyWeightMode = <T extends WeightSlots>(
  current: T,
  mode: WeightTabValue,
  defaults: WeightModeDefaults,
): T => {
  if (mode === 'none') {
    return {
      ...current,
      weightOneUnit: null,
      weightOneValue: null,
      weightTwoUnit: null,
      weightTwoValue: null,
    };
  }

  const unit = current.weightOneUnit ?? defaults.unit;
  const one = current.weightOneValue || defaults.value;

  if (mode === '2h') {
    return {
      ...current,
      weightOneUnit: unit,
      weightOneValue: one,
      weightTwoUnit: null,
      weightTwoValue: null,
    };
  }

  if (mode === '1h') {
    return {
      ...current,
      weightOneUnit: unit,
      weightOneValue: one,
      weightTwoUnit: null,
      weightTwoValue: 0,
    };
  }

  return {
    ...current,
    weightOneUnit: unit,
    weightOneValue: one,
    weightTwoUnit: unit,
    weightTwoValue: current.weightTwoValue || one,
  };
};
