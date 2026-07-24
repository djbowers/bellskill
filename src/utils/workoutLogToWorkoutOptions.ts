import { MovementLog, WorkoutLog, WorkoutOptions } from '~/types';

import { resolveSharedWeights } from './resolveSharedWeights';

/**
 * Convert a completed {@link WorkoutLog} (plus its per-movement
 * {@link MovementLog}s) back into the {@link WorkoutOptions} shape so it can be
 * repeated. Carries forward the actual completed duration / rounds / volume as
 * the `previous*` hints used by the Start Workout builder.
 *
 * `startedAt` is intentionally omitted — the caller stamps it when the workout
 * actually starts.
 */
export const workoutLogToWorkoutOptions = (
  workoutLog: WorkoutLog,
  movementLogs: MovementLog[],
): Omit<WorkoutOptions, 'startedAt'> => {
  const completedDurationMs =
    workoutLog.completedAt.getTime() - workoutLog.startedAt.getTime();
  const previousMinutes = Math.round(completedDurationMs / 60000);
  const previousRounds = workoutLog.completedRounds ?? 0;
  const previousVolume =
    workoutLog.workoutGoalUnits === 'kilograms' && workoutLog.completedVolume
      ? workoutLog.completedVolume
      : undefined;

  const isComplexSet = workoutLog.complexSet === true;
  const sharedWeights = resolveSharedWeights(
    workoutLog.sharedWeightOneValue,
    workoutLog.sharedWeightOneUnit,
    workoutLog.sharedWeightTwoValue,
    workoutLog.sharedWeightTwoUnit,
    movementLogs,
  );

  return {
    complexSet: isComplexSet,
    intervalTimer: workoutLog.intervalTimer,
    movements: movementLogs.map((movementLog) => ({
      movementName: movementLog.movementName,
      repScheme: movementLog.repScheme,
      timedRungs: movementLog.timedRungs ?? false,
      weightOneUnit: isComplexSet
        ? sharedWeights.weightOneUnit
        : movementLog.weightOneUnit,
      weightOneValue: isComplexSet
        ? sharedWeights.weightOneValue
        : movementLog.weightOneValue,
      weightTwoUnit: isComplexSet
        ? sharedWeights.weightTwoUnit
        : movementLog.weightTwoUnit,
      weightTwoValue: isComplexSet
        ? sharedWeights.weightTwoValue
        : movementLog.weightTwoValue,
    })),
    restTimer: workoutLog.restTimer,
    sharedWeightOneUnit: isComplexSet ? sharedWeights.weightOneUnit : null,
    sharedWeightOneValue: isComplexSet ? sharedWeights.weightOneValue : null,
    sharedWeightTwoUnit: isComplexSet ? sharedWeights.weightTwoUnit : null,
    sharedWeightTwoValue: isComplexSet ? sharedWeights.weightTwoValue : null,
    title: workoutLog.title,
    preWorkoutNotes: workoutLog.preWorkoutNotes,
    workoutGoal: workoutLog.workoutGoal,
    workoutGoalUnits: workoutLog.workoutGoalUnits,
    previousVolume,
    previousMinutes,
    previousRounds,
  };
};
