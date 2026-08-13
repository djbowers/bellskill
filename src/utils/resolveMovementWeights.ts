import { MovementOptions, WeightUnit, WorkoutMode } from '~/types';

import { usesSharedBell } from './workoutMode';

/**
 * The two things that decide whether a movement is loaded with the shared
 * weight, plus the weight itself. Either axis may be omitted by a caller that
 * only knows one of them — see {@link usesSharedBell}.
 */
export interface SharedWeightOptions {
  workoutMode?: WorkoutMode | null;
  sharedBell?: boolean | null;
  sharedWeightOneUnit: WeightUnit | null;
  sharedWeightOneValue: number | null;
  sharedWeightTwoUnit: WeightUnit | null;
  sharedWeightTwoValue: number | null;
}

/**
 * The weights a movement will actually be performed at: its own, or the shared
 * weight when the workout runs off one bell. Read-only — the movement keeps its
 * own weight fields so turning the shared bell off restores what the user had.
 */
export const resolveMovementWeights = <T extends MovementOptions>(
  movement: T,
  options: SharedWeightOptions,
): T => {
  if (!usesSharedBell(options)) return movement;

  return {
    ...movement,
    weightOneUnit: options.sharedWeightOneUnit,
    weightOneValue: options.sharedWeightOneValue,
    weightTwoUnit: options.sharedWeightTwoUnit,
    weightTwoValue: options.sharedWeightTwoValue,
  };
};
