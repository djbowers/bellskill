import { MovementOptions } from '~/types';

import {
  SharedWeightOptions,
  resolveMovementWeights,
} from './resolveMovementWeights';

/**
 * Complex sets are loaded with one shared weight, but every consumer of
 * {@link MovementOptions} (live volume accumulation, movement_logs persistence)
 * reads the per-movement weight fields. Copy the shared weight onto each
 * movement so the two stores can't disagree; non-complex options pass through
 * untouched.
 */
export const applySharedWeights = <
  T extends SharedWeightOptions & { movements: MovementOptions[] },
>(
  options: T,
): T => {
  if (options.workoutMode !== 'complex') return options;

  return {
    ...options,
    movements: options.movements.map((movement) =>
      resolveMovementWeights(movement, options),
    ),
  };
};
