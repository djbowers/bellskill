import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { useProgramSession, useSession, useWorkoutOptions } from '~/contexts';
import { RoundSplit, WorkoutLog, WorkoutOptions } from '~/types';
import { fromWorkoutMode, usesSharedBell } from '~/utils';

import { supabase } from '../supabaseClient';
import { AnalyticsEvent, trackEvent } from './analytics';
import { completeProgramSession } from './useCompleteProgramSession';

interface LogWorkoutInput {
  completedReps: number;
  /** Reps per completed set, per movement — index-aligned with `movements`. */
  completedRepsByMovement: number[][];
  completedRounds: number;
  completedRungs: number;
  completedSides: number;
  completedVolume: number;
  /** Lap times, for the next run of this workout to race against. */
  roundSplits: RoundSplit[];
}

export const useLogWorkout = () => {
  const [workoutOptions] = useWorkoutOptions();
  const { user } = useSession();
  const [programSession, setProgramSession] = useProgramSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      completedReps,
      completedRepsByMovement,
      completedRounds,
      completedRungs,
      completedSides,
      completedVolume,
      roundSplits,
    }: LogWorkoutInput) =>
      logWorkout({
        completedReps,
        completedRepsByMovement,
        completedRounds,
        completedRungs,
        completedSides,
        completedVolume,
        roundSplits,
        programSessionId: programSession?.programSessionId ?? null,
        userId: user.id,
        workoutOptions,
      }),
    onSuccess: (workoutLogId) => {
      // Program tracking (Slice 3): if this workout was started from a program
      // session, advance the program — write a completion linked to the new
      // workout_logs row (flipping the enrollment to `completed` when it was the
      // last session, atomically inside the RPC). The completion is a separate
      // write; the workout_logs insert above is untouched. Fire-and-forget so it
      // never blocks the normal log/navigation path; clear the pending session
      // so a subsequent non-program log can't re-attach to it.
      if (programSession) {
        const { userProgramId, programSessionId } = programSession;
        setProgramSession(null);
        void completeProgramSession({
          userProgramId,
          programSessionId,
          workoutLogId,
          status: 'completed',
        })
          .then(() => {
            void queryClient.invalidateQueries({ queryKey: [QUERIES.ACTIVE_PROGRAM] });
          })
          .catch((error) => {
            console.error('Failed to advance program session', error);
          });
      }

      // Activation funnel (PROD-157). is_first_workout is read from the
      // WORKOUT_LOGS cache, warmed by StartWorkoutPage before the user reaches
      // the active workout; the canonical value is also derivable server-side
      // from workout_logs (see the user_activation view). On a cold cache (e.g.
      // a deep link straight to /active) the value is unknown, so emit null
      // rather than a misleading `false`.
      const cachedLogs = queryClient.getQueryData<WorkoutLog[]>([
        QUERIES.WORKOUT_LOGS,
      ]);
      const completedAt = Date.now();
      const startedAtMs = workoutOptions.startedAt?.getTime();
      const signupAtMs = user.created_at ? Date.parse(user.created_at) : NaN;

      void trackEvent({
        event: AnalyticsEvent.WorkoutCompleted,
        userId: user.id,
        properties: {
          // Integer PK of the workout_logs row (workout_logs.id), not a UUID.
          workout_log_id: workoutLogId,
          is_first_workout:
            cachedLogs === undefined ? null : cachedLogs.length === 0,
          // null when the start time is genuinely unknown (no startedAt on the
          // options); the DB workout_logs.started_at has its own now() fallback.
          duration_seconds:
            startedAtMs != null
              ? Math.round((completedAt - startedAtMs) / 1000)
              : null,
          seconds_since_signup: Number.isNaN(signupAtMs)
            ? null
            : Math.round((completedAt - signupAtMs) / 1000),
        },
      });
    },
  });
};

/**
 * The persisted arrangement and weight-model columns. `workout_mode` /
 * `shared_bell` are the real ones; the legacy boolean pair is written alongside
 * so a client still reading them sees a consistent row until they're dropped.
 */
const toWorkoutLogModeColumns = (
  mode: WorkoutOptions['workoutMode'],
  sharedBell: boolean,
) => {
  const { complexSet, straightSets } = fromWorkoutMode(mode);
  return {
    workout_mode: mode,
    shared_bell: sharedBell,
    complex_set: complexSet,
    straight_sets: straightSets,
  };
};

const logWorkout = async ({
  completedReps,
  completedRepsByMovement,
  completedRounds,
  completedRungs,
  completedSides,
  completedVolume,
  roundSplits,
  programSessionId,
  userId,
  workoutOptions,
}: {
  completedReps: number;
  completedRepsByMovement: number[][];
  completedRounds: number;
  completedRungs: number;
  completedSides: number;
  completedVolume: number;
  roundSplits: RoundSplit[];
  programSessionId: string | null;
  userId: string;
  workoutOptions: WorkoutOptions;
}) => {
  const {
    workoutMode,
    intervalTimer,
    movements,
    restTimer,
    sharedWeightOneUnit,
    sharedWeightOneValue,
    sharedWeightTwoUnit,
    sharedWeightTwoValue,
    startedAt,
    title,
    preWorkoutNotes,
    workoutGoal,
    workoutGoalUnits,
  } = workoutOptions;

  const { data: userMovements } = await supabase
    .from('user_movements')
    .select('id, canonical_name')
    .eq('user_id', userId)
    .in(
      'canonical_name',
      movements.map((m) => m.movementName),
    );

  const userMovementIdByName = Object.fromEntries(
    (userMovements ?? []).map((um) => [um.canonical_name, um.id]),
  );

  const { error, data: workoutLogs } = await supabase
    .from('workout_logs')
    .insert({
      completed_at: new Date().toISOString(),
      completed_reps: completedReps,
      completed_rounds: completedRounds,
      completed_rungs: completedRungs,
      completed_sides: completedSides,
      completed_volume: completedVolume,
      ...toWorkoutLogModeColumns(workoutMode, usesSharedBell(workoutOptions)),
      interval_timer: intervalTimer,
      movements: movements.map((movement) => movement.movementName),
      rest_timer: restTimer,
      shared_weight_one_unit: sharedWeightOneUnit,
      shared_weight_one_value: sharedWeightOneValue,
      shared_weight_two_unit: sharedWeightTwoUnit,
      shared_weight_two_value: sharedWeightTwoValue,
      started_at: (startedAt ?? new Date()).toISOString(),
      // Provenance, not progress: program_session_completions stays the source
      // of truth for what's finished. This records which prescription produced
      // the log, so a later run of the same session can find it to race against
      // — including after an auto-repeat loop wipes the completions.
      program_session_id: programSessionId,
      user_id: userId,
      title,
      pre_workout_notes: preWorkoutNotes,
      workout_goal: workoutGoal,
      workout_goal_units: workoutGoalUnits,
    })
    .select('id');

  if (error) {
    console.error(error);
    throw error;
  }

  const workoutLogId = workoutLogs[0].id;

  const { error: movementLogError } = await supabase
    .from('movement_logs')
    .insert(
      movements.map((movement, movementIndex) => ({
        movement_name: movement.movementName,
        user_movement_id: userMovementIdByName[movement.movementName] ?? null,
        rep_scheme: movement.repScheme,
        completed_rep_scheme: completedRepsByMovement[movementIndex] ?? [],
        timed_rungs: movement.timedRungs ?? false,
        unilateral: movement.unilateral ?? false,
        weight_one_unit: movement.weightOneUnit,
        weight_one_value: movement.weightOneValue,
        weight_two_unit: movement.weightTwoUnit,
        weight_two_value: movement.weightTwoValue,
        user_id: userId,
        workout_log_id: workoutLogId,
      })),
    );

  if (movementLogError) {
    console.error(movementLogError);
    throw movementLogError;
  }

  if (roundSplits.length > 0) {
    const { error: roundSplitError } = await supabase
      .from('workout_round_splits')
      .insert(
        roundSplits.map((split) => ({
          workout_log_id: workoutLogId,
          user_id: userId,
          round_index: split.roundIndex,
          elapsed_ms: split.elapsedMs,
        })),
      );

    // Splits only feed the next session's ghost — losing them costs pacing on a
    // future workout, not this one's record. Never fail a finished workout over
    // them: the user has already put the bell down.
    if (roundSplitError) console.error(roundSplitError);
  }

  return workoutLogId;
};
