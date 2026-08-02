import { MovementOptions, WeightUnit } from '~/types';

export interface SharedWeightOptions {
  complexSet: boolean;
  sharedWeightOneUnit: WeightUnit | null;
  sharedWeightOneValue: number | null;
  sharedWeightTwoUnit: WeightUnit | null;
  sharedWeightTwoValue: number | null;
}

/**
 * The weights a movement will actually be performed at: its own, or the shared
 * weight when it's part of a complex set. Read-only — the movement keeps its own
 * weight fields so toggling complex off restores what the user had.
 */
export const resolveMovementWeights = <T extends MovementOptions>(
  movement: T,
  options: SharedWeightOptions,
): T => {
  if (!options.complexSet) return movement;

  return {
    ...movement,
    weightOneUnit: options.sharedWeightOneUnit,
    weightOneValue: options.sharedWeightOneValue,
    weightTwoUnit: options.sharedWeightTwoUnit,
    weightTwoValue: options.sharedWeightTwoValue,
  };
};
