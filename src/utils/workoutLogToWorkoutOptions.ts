import { MovementLog, WorkoutLog, WorkoutOptions } from '~/types';

import { applySharedWeights } from './applySharedWeights';
import { resolveSharedWeights } from './resolveSharedWeights';
import { usesSharedBell } from './workoutMode';

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

  const sharedBell = usesSharedBell(workoutLog);
  const sharedWeights = resolveSharedWeights(
    workoutLog.sharedWeightOneValue,
    workoutLog.sharedWeightOneUnit,
    workoutLog.sharedWeightTwoValue,
    workoutLog.sharedWeightTwoUnit,
    movementLogs,
  );

  return applySharedWeights({
    workoutMode: workoutLog.workoutMode,
    sharedBell,
    intervalTimer: workoutLog.intervalTimer,
    movements: movementLogs.map((movementLog) => ({
      movementName: movementLog.movementName,
      repScheme: movementLog.repScheme,
      timedRungs: movementLog.timedRungs ?? false,
      weightOneUnit: movementLog.weightOneUnit,
      weightOneValue: movementLog.weightOneValue,
      weightTwoUnit: movementLog.weightTwoUnit,
      weightTwoValue: movementLog.weightTwoValue,
    })),
    restTimer: workoutLog.restTimer,
    sharedWeightOneUnit: sharedBell ? sharedWeights.weightOneUnit : null,
    sharedWeightOneValue: sharedBell ? sharedWeights.weightOneValue : null,
    sharedWeightTwoUnit: sharedBell ? sharedWeights.weightTwoUnit : null,
    sharedWeightTwoValue: sharedBell ? sharedWeights.weightTwoValue : null,
    title: workoutLog.title,
    preWorkoutNotes: workoutLog.preWorkoutNotes,
    workoutGoal: workoutLog.workoutGoal,
    workoutGoalUnits: workoutLog.workoutGoalUnits,
    previousVolume,
    previousMinutes,
    previousRounds,
  });
};
