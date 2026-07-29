import { MovementOptions, WeightUnit } from '~/types';

interface SharedWeightOptions {
  complexSet: boolean;
  movements: MovementOptions[];
  sharedWeightOneUnit: WeightUnit | null;
  sharedWeightOneValue: number | null;
  sharedWeightTwoUnit: WeightUnit | null;
  sharedWeightTwoValue: number | null;
}

/**
 * Complex sets are loaded with one shared weight, but every consumer of
 * {@link MovementOptions} (live volume accumulation, movement_logs persistence)
 * reads the per-movement weight fields. Copy the shared weight onto each
 * movement so the two stores can't disagree; non-complex options pass through
 * untouched.
 */
export const applySharedWeights = <T extends SharedWeightOptions>(
  options: T,
): T => {
  if (!options.complexSet) return options;

  return {
    ...options,
    movements: options.movements.map((movement) => ({
      ...movement,
      weightOneUnit: options.sharedWeightOneUnit,
      weightOneValue: options.sharedWeightOneValue,
      weightTwoUnit: options.sharedWeightTwoUnit,
      weightTwoValue: options.sharedWeightTwoValue,
    })),
  };
};
