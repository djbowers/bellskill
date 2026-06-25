import { MovementLog, WeightUnit } from '~/types';

export interface SharedWeights {
  weightOneUnit: WeightUnit | null;
  weightOneValue: number | null;
  weightTwoUnit: WeightUnit | null;
  weightTwoValue: number | null;
}

export const resolveSharedWeights = (
  sharedWeightOneValue: number | null | undefined,
  sharedWeightOneUnit: WeightUnit | null | undefined,
  sharedWeightTwoValue: number | null | undefined,
  sharedWeightTwoUnit: WeightUnit | null | undefined,
  movementLogs: MovementLog[],
): SharedWeights => {
  const fallback = movementLogs[0];

  if (sharedWeightOneValue == null && sharedWeightOneUnit == null) {
    return {
      weightOneValue: fallback?.weightOneValue ?? null,
      weightOneUnit: fallback?.weightOneUnit ?? null,
      weightTwoValue: fallback?.weightTwoValue ?? null,
      weightTwoUnit: fallback?.weightTwoUnit ?? null,
    };
  }

  return {
    weightOneValue: sharedWeightOneValue ?? null,
    weightOneUnit: sharedWeightOneUnit ?? null,
    weightTwoValue: sharedWeightTwoValue ?? null,
    weightTwoUnit: sharedWeightTwoUnit ?? null,
  };
};
