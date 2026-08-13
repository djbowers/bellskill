import { MovementOptions } from '~/types';

import {
  SharedWeightOptions,
  resolveMovementWeights,
} from './resolveMovementWeights';
import { usesSharedBell } from './workoutMode';

/**
 * A shared-bell workout is loaded with one weight, but every consumer of
 * {@link MovementOptions} (live volume accumulation, movement_logs persistence)
 * reads the per-movement weight fields. Copy the shared weight onto each
 * movement so the two stores can't disagree; per-movement options pass through
 * untouched.
 */
export const applySharedWeights = <
  T extends SharedWeightOptions & { movements: MovementOptions[] },
>(
  options: T,
): T => {
  if (!usesSharedBell(options)) return options;

  return {
    ...options,
    movements: options.movements.map((movement) =>
      resolveMovementWeights(movement, options),
    ),
  };
};
