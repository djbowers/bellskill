import { MovementOptions, WorkoutMode } from '~/types';

interface SetProgressArgs {
  completedRounds: number;
  currentMovementIndex: number;
  currentMovementRungIndex: number;
  movements: MovementOptions[];
  workoutGoal: number;
  workoutMode: WorkoutMode;
}

export interface SetProgress {
  completedSets: number;
  totalSets: number;
}

/**
 * Circuit progress counted in sets rather than rounds, so the bar moves every
 * time a movement is finished instead of once per lap through all of them.
 *
 * Returns null for the modes that need no translation: complex, where the round
 * really is the unit of work, and straight sets, whose goal is already a set
 * count.
 *
 * A mirrored set (one-handed / mixed weights) is one set, not two — matching
 * how the page gates `advanceMovement` behind both sides.
 */
export const getSetProgress = ({
  completedRounds,
  currentMovementIndex,
  currentMovementRungIndex,
  movements,
  workoutGoal,
  workoutMode,
}: SetProgressArgs): SetProgress | null => {
  if (workoutMode !== 'circuit' || movements.length === 0) return null;

  // The last movement's ladder is the one that ends the round: every movement
  // shares a single rung pointer, and `isLastRung` is read off the movement the
  // pointer lands on last.
  const rungsPerRound = movements[movements.length - 1].repScheme.length;
  const setsPerRound = movements.length * rungsPerRound;

  const totalSets = workoutGoal * setsPerRound;
  const completedSets =
    completedRounds * setsPerRound +
    currentMovementRungIndex * movements.length +
    currentMovementIndex;

  return { completedSets: Math.min(completedSets, totalSets), totalSets };
};
