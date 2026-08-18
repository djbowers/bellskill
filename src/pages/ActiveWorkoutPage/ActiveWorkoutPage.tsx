import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  AnalyticsEvent,
  trackEvent,
  useFeatureFlags,
  useGhostSession,
  useLogWorkout,
} from '~/api';
import { Page, SpotifyMiniPlayer } from '~/components';
import { ConfirmDialog } from '~/components/ConfirmDialog';
import { Button } from '~/components/ui/button';
import { useProgramSession, useSession, useWorkoutOptions } from '~/contexts';
import { useCountdownTimer, useFeatures } from '~/hooks';
import { MovementOptions, RoundSplit } from '~/types';
import {
  formatRungDuration,
  isMaxRung,
  playDing,
  playStartCue,
  unlockAudio,
} from '~/utils';

import {
  ActiveWorkoutControls,
  ComplexMovementDisplay,
  CurrentMovement,
  GhostRail,
  LapDeltaPill,
  RepsCompletedDialog,
  WorkoutProgress,
  WorkoutSummary,
} from './components';
import { useRequestWakeLock, useSetStopwatch } from './hooks';
import { getLapDelta, getRailScale, getSetProgress } from './utils';

const LB_TO_KG = 0.453592;

/** Seed for the first max-rep set of a movement; later sets seed from the last. */
const DEFAULT_MAX_REPS = 10;

interface ActiveWorkoutPageProps {
  defaultPaused?: boolean;
}

export const ActiveWorkoutPage = ({
  defaultPaused = true,
}: ActiveWorkoutPageProps) => {
  const features = useFeatures();

  const [
    {
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
      previousWorkoutLogId,
    },
  ] = useWorkoutOptions();

  const {
    mutate: logWorkout,
    data: workoutLogId,
    isPending: logWorkoutLoading,
  } = useLogWorkout();

  const navigate = useNavigate();
  const requestWakeLock = useRequestWakeLock();
  const [programSession, setProgramSession] = useProgramSession();
  const session = useSession();
  const userId = session?.user?.id;
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const hasTimedMovements = movements.some((movement) => movement.timedRungs);

  const [
    formattedTimeRemaining,
    {
      milliseconds: remainingMilliseconds,
      pause: pauseWorkoutTimer,
      paused: workoutTimerPaused,
      play: startWorkoutTimer,
    },
  ] = useCountdownTimer(workoutGoal, {
    // The workout timer's paused state is also the start gate: while it is
    // paused the controls show Play, and only finishCountdown starts the
    // interval / rung clocks. So anything that runs on its own clock has to be
    // listed here, or the workout opens with a countdown that never ticks.
    defaultPaused:
      defaultPaused &&
      ((workoutGoalUnits === 'minutes' && workoutGoal > 0) ||
        intervalTimer > 0 ||
        hasTimedMovements),
    disabled: workoutGoalUnits !== 'minutes',
  });

  const [
    formattedIntervalRemaining,
    {
      milliseconds: intervalRemainingMilliseconds,
      pause: pauseIntervalTimer,
      play: startIntervalTimer,
      reset: resetIntervalTimer,
    },
  ] = useCountdownTimer(intervalTimer / 60, {
    defaultPaused: defaultPaused && intervalTimer > 0,
    timeFormat: 'ss.S',
  });

  const [
    formattedRestRemaining,
    {
      milliseconds: restRemainingMilliseconds,
      pause: pauseRestTimer,
      play: startRestTimer,
      reset: resetRestTimer,
    },
  ] = useCountdownTimer(restTimer / 60, {
    defaultPaused: true,
    timeFormat: 'ss.S',
  });

  const [
    formattedCountdownRemaining,
    {
      milliseconds: countdownRemainingMilliseconds,
      pause: pauseCountdownTimer,
      play: startCountdownTimer,
      reset: resetCountdownTimer,
    },
  ] = useCountdownTimer(3 / 60, { defaultPaused: true, timeFormat: 's.S' });

  const [currentMovementIndex, setCurrentMovementIndex] = useState<number>(0);
  const [currentMovementRungIndex, setCurrentMovementRungIndex] =
    useState<number>(0);
  const [completedReps, setCompletedReps] = useState<number>(0);
  const [completedRounds, setCompletedRounds] = useState<number>(0);
  const [completedRungs, setCompletedRungs] = useState<number>(0);
  const [completedSides, setCompletedSides] = useState<number>(0);
  const [completedVolume, setCompletedVolume] = useState<number>(0);

  // The actuals record: reps per set in completion order, per movement. Every
  // completed set appends — the prescription on a plain Continue, the reported
  // count when the dialog was used — so it survives to movement_logs as what was
  // really done, next to rep_scheme's plan.
  const [completedRepsByMovement, setCompletedRepsByMovement] = useState<
    number[][]
  >(() => movements.map(() => []));
  const [repsPromptOpen, setRepsPromptOpen] = useState(false);

  // The last count reported for a MAX rung, per movement — the seed for the next
  // one. Kept apart from completedRepsByMovement, whose last entry on a ladder is
  // whatever prescribed rung came before the max one (seeding a to-failure set
  // with the 2 of a 1-2-max ladder is worse than useless).
  const [lastMaxReported, setLastMaxReported] = useState<
    Record<number, number>
  >({});

  // Undo history: one snapshot of the pre-advance state per completed set, so
  // Previous restores by popping rather than inverting the mode-specific
  // traversal. lastMaxReported is deliberately left out — an undone max set
  // should still seed the re-asked dialog with the count that was entered.
  interface SetSnapshot {
    currentMovementIndex: number;
    currentMovementRungIndex: number;
    isMirrorSet: boolean;
    completedReps: number;
    completedRounds: number;
    completedRungs: number;
    completedSides: number;
    completedVolume: number;
    completedRepsByMovement: number[][];
    roundSplitsLength: number;
    lastLap: { roundIndex: number; lapMs: number } | null;
  }
  const [setHistory, setSetHistory] = useState<SetSnapshot[]>([]);

  // Lap times for this session, written once at finish. A ref so stamping a
  // round costs no render mid-set.
  const roundSplitsRef = useRef<RoundSplit[]>([]);
  // The round just finished, for the ghost pill. Null until the first round
  // lands, and again once the pill has had its say.
  const [lastLap, setLastLap] = useState<{
    roundIndex: number;
    lapMs: number;
  } | null>(null);

  // Ghost pacing: the previous run of this workout, if there is one. Resolves
  // after the page mounts — nothing needs it until the first round lands, and
  // waiting on it would put a network round trip in front of the Start button.
  // Off for straight sets: those sessions chase added weight or reps, not a
  // prior clock, so racing the previous run's pace is the wrong incentive.
  const { features: experimentFeatures } = useFeatureFlags();
  const ghostPacingEnabled =
    experimentFeatures.ghostPacing && workoutMode !== 'straightSets';
  const { data: ghost } = useGhostSession({
    previousWorkoutLogId,
    programSessionId: programSession?.programSessionId,
    enabled: ghostPacingEnabled,
  });

  const [isMirrorSet, setIsMirrorSet] = useState<boolean>(false); // for one-handed movements and mixed weights
  const [isEffectActive, setIsEffectActive] = useState<boolean>(false);
  const [isRestActive, setIsRestActive] = useState<boolean>(false);
  const [isCountdownActive, setIsCountdownActive] = useState<boolean>(false);

  // Latches true on the first real start (post-countdown). Drives the pre-workout
  // notes: fully shown on the ready screen, collapsed once lifting begins so a
  // later pause never re-expands them.
  const [hasStarted, setHasStarted] = useState<boolean>(false);

  const lastMovementIndex = movements.length - 1;
  const isLastMovement = currentMovementIndex === lastMovementIndex;
  const currentMovement = movements[currentMovementIndex];

  const rungFor = (movement: MovementOptions, rungIndex: number) =>
    movement.repScheme[Math.min(rungIndex, movement.repScheme.length - 1)];

  const currentRung = rungFor(currentMovement, currentMovementRungIndex);

  // Timed movements (PROD-200): a timed movement's repScheme holds SECONDS per
  // rung, not reps. The rung runs on its own countdown that auto-fires
  // "continue" on expiry, exactly as intervalTimer does. The builder makes the
  // two mutually exclusive; the effects below also guard, since both would
  // otherwise drive continueWorkout and double-advance.
  //
  // A max timed rung is the exception: there is no duration to count down, so it
  // runs on the stopwatch below and ends on a Continue press like a max-rep set.
  const isTimedRung =
    currentMovement.timedRungs === true && !isMaxRung(currentRung);
  const currentRungSeconds = isTimedRung ? currentRung : 0;

  const [
    formattedRungRemaining,
    {
      milliseconds: rungRemainingMilliseconds,
      pause: pauseRungTimer,
      play: startRungTimer,
      reset: resetRungTimer,
    },
  ] = useCountdownTimer(currentRungSeconds / 60, {
    defaultPaused: defaultPaused && hasTimedMovements,
    timeFormat: 'ss.S',
  });

  // Only a max timed rung needs the stopwatch, and only while it is actually
  // running — not during the opening countdown, a pause, or rest.
  const isMaxTimedRung =
    currentMovement.timedRungs === true && isMaxRung(currentRung);
  const {
    elapsedSeconds,
    elapsedMilliseconds,
    reset: resetSetStopwatch,
  } = useSetStopwatch({
    running:
      isMaxTimedRung &&
      !workoutTimerPaused &&
      !isRestActive &&
      !isCountdownActive,
  });

  const primaryWeightSide = isMirrorSet ? 'right' : 'left'; // todo: make primary weight side configurable

  const primaryWeightUnit = currentMovement.weightOneUnit;
  const secondaryWeightUnit = currentMovement.weightTwoUnit;

  const primaryWeightValue = currentMovement.weightOneValue;
  const secondaryWeightValue = currentMovement.weightTwoValue;

  const currentTotalWeight =
    (primaryWeightUnit === 'pounds'
      ? (primaryWeightValue ?? 0) * LB_TO_KG
      : (primaryWeightValue ?? 0)) +
    (secondaryWeightUnit === 'pounds'
      ? (secondaryWeightValue ?? 0) * LB_TO_KG
      : (secondaryWeightValue ?? 0));

  const isOneHanded =
    primaryWeightValue !== null &&
    primaryWeightValue > 0 &&
    secondaryWeightValue === 0;

  const isDoubleWeights =
    primaryWeightValue !== null &&
    primaryWeightValue > 0 &&
    secondaryWeightValue !== null &&
    secondaryWeightValue > 0;

  const isMixedWeights =
    isDoubleWeights && primaryWeightValue !== secondaryWeightValue;

  const leftWeightUnit =
    primaryWeightSide === 'left' ? primaryWeightUnit : secondaryWeightUnit;

  const leftWeightValue =
    primaryWeightSide === 'left'
      ? primaryWeightValue
      : isOneHanded
        ? null
        : secondaryWeightValue;

  const rightWeightUnit =
    primaryWeightSide === 'right' ? primaryWeightUnit : secondaryWeightUnit;

  const rightWeightValue =
    primaryWeightSide === 'right'
      ? primaryWeightValue
      : isOneHanded
        ? null
        : secondaryWeightValue;

  const currentMovementRungs = currentMovement.repScheme.length;
  const isLastRung = currentMovementRungIndex === currentMovementRungs - 1;
  const isStraightSets = workoutMode === 'straightSets';
  const currentRound = completedRounds + 1;
  // A unilateral-leg movement mirrors on the working leg, so it runs each rung
  // twice whatever the bells are doing — including two-hand and double-bell.
  const shouldMirrorReps =
    isOneHanded || isMixedWeights || Boolean(currentMovement.unilateral);

  const totalSides = shouldMirrorReps ? 2 : 1;
  const currentSide = isMirrorSet ? 2 : 1; // 1 = first side (left), 2 = second side (right)

  const totalIntervalMilliseconds = intervalTimer * 1000;
  const intervalCompletedPercentage =
    ((totalIntervalMilliseconds - intervalRemainingMilliseconds) /
      totalIntervalMilliseconds) *
    100;

  const totalRestMilliseconds = restTimer * 1000;
  const restCompletedPercentage =
    ((totalRestMilliseconds - restRemainingMilliseconds) /
      totalRestMilliseconds) *
    100;

  const totalRungMilliseconds = currentRungSeconds * 1000;
  const rungCompletedPercentage =
    ((totalRungMilliseconds - rungRemainingMilliseconds) /
      totalRungMilliseconds) *
    100;

  const isComplex = workoutMode === 'complex';

  // Straight sets already counts each set as a round against a goal derived from
  // the set list, so it feeds the bar directly; circuit needs the translation.
  const setProgress = isStraightSets
    ? { completedSets: completedRounds, totalSets: workoutGoal }
    : getSetProgress({
        completedRounds,
        currentMovementIndex,
        currentMovementRungIndex,
        movements,
        workoutGoal,
        workoutMode,
      });

  // Complex mode: round completes when the longest movement's final rung is done
  const maxMovementRungs = isComplex
    ? Math.max(...movements.map((m) => m.repScheme.length))
    : currentMovementRungs;

  // Single-arm complex (PROD-245): every movement is a one-hand single bell
  // (weightTwoValue === 0), so each interval fire alternates hands the way a
  // non-complex one-handed movement does. weightTwoValue null (two-hand) or > 0
  // (double) are excluded, keeping the two-hand and double-bell complexes on
  // their existing no-side-switch path.
  const isSingleArmComplex =
    isComplex &&
    movements.every(
      (m) =>
        m.weightOneValue !== null &&
        m.weightOneValue > 0 &&
        m.weightTwoValue === 0,
    );

  // What a movement contributes to this set, in its own unit: reps, or seconds
  // when it is timed. `reported` is what the user entered in the reps dialog —
  // the only source for a max rep rung, and the correction to a rung they fell
  // short of otherwise. A max timed rung reads the stopwatch instead: the
  // Continue press is the measurement, so there is nothing to ask for.
  const valueForMovement = (
    movementIndex: number,
    reported?: Record<number, number>,
  ) => {
    const movement = movements[movementIndex];
    const rung = rungFor(movement, currentMovementRungIndex);
    if (movement.timedRungs) return isMaxRung(rung) ? elapsedSeconds : rung;
    return reported?.[movementIndex] ?? (isMaxRung(rung) ? 0 : rung);
  };

  // Seconds are not reps: a timed rung contributes neither reps nor volume, or a
  // 2-minute carry at 24 kg would log 2,880 kg and end a kilograms-goal workout
  // instantly.
  const repsForMovement = (
    movementIndex: number,
    reported?: Record<number, number>,
  ) =>
    movements[movementIndex].timedRungs
      ? 0
      : valueForMovement(movementIndex, reported);

  // A complex set completes every movement at once; otherwise only the current
  // one advanced, so only it gets an entry.
  const recordCompletedReps = (reported?: Record<number, number>) =>
    setCompletedRepsByMovement((prev) =>
      prev.map((entries, movementIndex) =>
        isComplex || movementIndex === currentMovementIndex
          ? [...entries, valueForMovement(movementIndex, reported)]
          : entries,
      ),
    );

  const incrementReps = (reported?: Record<number, number>) =>
    setCompletedReps(
      (prev) => prev + repsForMovement(currentMovementIndex, reported),
    );

  const incrementRepsComplex = (reported?: Record<number, number>) =>
    setCompletedReps(
      (prev) =>
        prev +
        movements.reduce(
          (sum, _, movementIndex) =>
            sum + repsForMovement(movementIndex, reported),
          0,
        ),
    );

  const incrementRungs = () => setCompletedRungs((prev) => prev + 1);

  const incrementSides = () => setCompletedSides((prev) => prev + 1);

  /**
   * Stamps the lap time for the round just finished, then advances the counter.
   *
   * Every mode routes its round boundary through here — circuit via
   * goToNextRung, complex via goToNextSetComplex, straight sets via
   * goToNextRungStraight — so this is the one place a round ends.
   *
   * The index comes from the ref's own length rather than `completedRounds`,
   * which may not have committed yet; the ref is the single writer, so it can
   * never disagree with itself. Splits live in a ref and not state because a
   * lap time changes nothing on screen until the round after it.
   */
  const incrementRounds = () => {
    if (startedAt) {
      const elapsedMs = Date.now() - startedAt.getTime();
      const previousElapsedMs =
        roundSplitsRef.current[roundSplitsRef.current.length - 1]?.elapsedMs ??
        0;
      const roundIndex = roundSplitsRef.current.length;

      roundSplitsRef.current.push({ roundIndex, elapsedMs });
      setLastLap({ roundIndex, lapMs: elapsedMs - previousElapsedMs });
    }

    setCompletedRounds((prev) => prev + 1);
  };

  const incrementVolume = (reported?: Record<number, number>) =>
    setCompletedVolume(
      (prev) =>
        prev +
        currentTotalWeight * repsForMovement(currentMovementIndex, reported),
    );

  const incrementVolumeComplex = (reported?: Record<number, number>) => {
    const complexVolume = movements.reduce((sum, m, movementIndex) => {
      const weight =
        (m.weightOneUnit === 'pounds'
          ? (m.weightOneValue ?? 0) * LB_TO_KG
          : (m.weightOneValue ?? 0)) +
        (m.weightTwoUnit === 'pounds'
          ? (m.weightTwoValue ?? 0) * LB_TO_KG
          : (m.weightTwoValue ?? 0));
      return sum + weight * repsForMovement(movementIndex, reported);
    }, 0);
    setCompletedVolume((prev) => prev + complexVolume);
  };

  const goToNextRung = () => {
    incrementRungs();
    if (isLastRung) {
      incrementRounds();
      setCurrentMovementRungIndex(0);
    } else {
      setCurrentMovementRungIndex((prev) => prev + 1);
    }
  };

  const goToNextSetComplex = () => {
    const isLastRungInComplex =
      currentMovementRungIndex === maxMovementRungs - 1;
    incrementRungs();
    if (isLastRungInComplex) {
      incrementRounds();
      setCurrentMovementRungIndex(0);
    } else {
      setCurrentMovementRungIndex((prev) => prev + 1);
    }
  };

  // Single-arm complex: mirror the non-complex goToNextSide cadence — the first
  // fire flips to the other hand at the same rung, the second returns and
  // advances the rung/round. One round = one L+R pair.
  const goToNextSideComplex = () => {
    if (isMirrorSet) {
      setIsMirrorSet(false);
      goToNextSetComplex();
    } else {
      setIsMirrorSet(true);
    }
  };

  const goToNextMovement = () => {
    if (isLastMovement) {
      setCurrentMovementIndex(0);
      goToNextRung();
    } else {
      setCurrentMovementIndex((prev) => prev + 1);
    }
  };

  // Straight sets (PROD-243): a movement's rep scheme is its set list — [5,5,5]
  // is three sets of five, done back-to-back — so the movement index only moves
  // forward and never returns to a finished movement. There is no round here:
  // the builder derives `workoutGoal` as the total set count, so counting each
  // set as a "round" lets handleRoundsGoalReached end the workout unchanged.
  const goToNextRungStraight = () => {
    incrementRungs();
    incrementRounds();

    if (!isLastRung) {
      setCurrentMovementRungIndex((prev) => prev + 1);
      return;
    }

    setCurrentMovementRungIndex(0);
    if (!isLastMovement) {
      setCurrentMovementIndex((prev) => prev + 1);
      setIsMirrorSet(false);
    }
  };

  const advanceMovement = () =>
    isStraightSets ? goToNextRungStraight() : goToNextMovement();

  const goToNextSide = () => {
    if (isMirrorSet) {
      setIsMirrorSet(false);
      advanceMovement();
    } else {
      setIsMirrorSet(true);
    }
  };

  const goToNextSet = () => {
    if (shouldMirrorReps) {
      goToNextSide();
    } else {
      advanceMovement();
    }
  };

  const startRest = () => {
    setIsRestActive(true);
    startRestTimer();
    if (intervalTimer > 0) pauseIntervalTimer();
    if (hasTimedMovements) pauseRungTimer();
  };

  const endRest = () => {
    pauseRestTimer();
    resetRestTimer();
    setIsRestActive(false);
    if (intervalTimer > 0) startIntervalTimer();
    if (hasTimedMovements) startRungTimer();
  };

  const finishRest = () => {
    playDing();
    endRest();
  };

  const finishInterval = () => {
    playDing();
    continueWorkout();
    resetIntervalTimer();
  };

  const finishRung = () => {
    playDing();
    continueWorkout();
  };

  // Every advance handler reads this render's indexes (isLastRung,
  // isLastMovement, isMirrorSet), so a second continue fired before React
  // commits would advance from stale state — double-counting reps and stepping
  // the rung twice, e.g. "Set 3 of 2". One advance per render; the effect below
  // re-arms once the new state is on screen.
  const advanceArmedRef = useRef(true);

  useEffect(function rearmContinue() {
    advanceArmedRef.current = true;
  });

  const continueWorkout = (reported?: Record<number, number>) => {
    if (!advanceArmedRef.current) return;
    advanceArmedRef.current = false;

    // Built eagerly: the updater below runs after the advance has pushed this
    // set's round split, so a lazy roundSplitsRef read would be one too long.
    const snapshot: SetSnapshot = {
      currentMovementIndex,
      currentMovementRungIndex,
      isMirrorSet,
      completedReps,
      completedRounds,
      completedRungs,
      completedSides,
      completedVolume,
      completedRepsByMovement,
      roundSplitsLength: roundSplitsRef.current.length,
      lastLap,
    };
    setSetHistory((prev) => [...prev, snapshot]);

    requestWakeLock();
    incrementSides(); // each continue completes one side of work
    recordCompletedReps(reported);
    if (isComplex) {
      incrementRepsComplex(reported);
      incrementVolumeComplex(reported);
      if (isSingleArmComplex) {
        goToNextSideComplex();
      } else {
        goToNextSetComplex();
      }
    } else {
      incrementReps(reported);
      incrementVolume(reported);
      goToNextSet();
    }
    if (restTimer > 0) startRest();
  };

  const finishCountdown = () => {
    playStartCue();
    pauseCountdownTimer();
    setIsCountdownActive(false);
    resetCountdownTimer();
    startWorkoutTimer();
    setHasStarted(true);
    if (intervalTimer > 0 && !isRestActive) startIntervalTimer();
    if (hasTimedMovements && !isRestActive) startRungTimer();
    if (isRestActive) startRestTimer();
  };

  const pauseWorkout = () => {
    pauseWorkoutTimer();
    pauseIntervalTimer();
    pauseRungTimer();
    if (isRestActive) pauseRestTimer();
  };

  const finishWorkout = () => {
    if (logWorkoutLoading) return;

    pauseWorkout();
    logWorkout({
      completedReps,
      completedRepsByMovement,
      completedRounds,
      completedRungs,
      completedSides,
      completedVolume: Math.round(completedVolume),
      roundSplits: roundSplitsRef.current,
    });
  };

  const cancelWorkout = () => {
    pauseWorkout();
    setProgramSession(null);
    if (userId) {
      void trackEvent({
        event: AnalyticsEvent.WorkoutCancelled,
        userId,
        properties: {
          completedReps,
          completedRounds,
          completedVolume: Math.round(completedVolume),
          elapsedSeconds: startedAt
            ? Math.round((Date.now() - startedAt.getTime()) / 1000)
            : 0,
        },
      });
    }
    navigate('/');
  };

  // Which movements the reps dialog covers. Timed ones are excluded either way:
  // a fixed timed rung runs its countdown, and a max timed rung is measured by
  // the stopwatch, so neither has anything to ask.
  const setMovementIndexes = isComplex
    ? movements.map((_, index) => index)
    : [currentMovementIndex];
  const promptMovementIndexes = setMovementIndexes.filter(
    (index) => !movements[index].timedRungs,
  );

  const isMaxRepRung = (index: number) =>
    !movements[index].timedRungs &&
    isMaxRung(rungFor(movements[index], currentMovementRungIndex));

  // A max rep rung can't be completed by a bare press — there is no
  // prescription to assume, so the dialog is the only way through.
  const requiresRepsPrompt = promptMovementIndexes.some(isMaxRepRung);
  const canAdjustReps = promptMovementIndexes.length > 0 && !requiresRepsPrompt;

  const promptMovements = promptMovementIndexes.map((index) => {
    const movement = movements[index];
    const rung = rungFor(movement, currentMovementRungIndex);
    // A later max set seeds from the last max you reported — the honest guess is
    // "about what you managed last time", not a fixed number.
    return {
      movementIndex: index,
      movementName: movement.movementName,
      defaultReps: isMaxRung(rung)
        ? (lastMaxReported[index] ?? DEFAULT_MAX_REPS)
        : rung,
    };
  });

  const openRepsPrompt = () => {
    unlockAudio();
    setRepsPromptOpen(true);
  };

  const handleConfirmReps = (reported: Record<number, number>) => {
    setRepsPromptOpen(false);
    setIsEffectActive(true);
    setLastMaxReported((prev) => {
      const next = { ...prev };
      for (const [index, reps] of Object.entries(reported)) {
        if (isMaxRepRung(Number(index))) next[Number(index)] = reps;
      }
      return next;
    });
    continueWorkout(reported);
  };

  const handleClickContinue = () => {
    if (requiresRepsPrompt) {
      openRepsPrompt();
      return;
    }
    unlockAudio();
    setIsEffectActive(true);
    continueWorkout();
  };

  const handleClickStart = () => {
    unlockAudio();
    startCountdownTimer();
    setIsCountdownActive(true);
  };

  // Rewind one completed set: pop its snapshot and restore everything the
  // advance changed. Shares the one-advance-per-render guard with
  // continueWorkout so an interval tick can't advance from the same render.
  // The rung timer and max-timed stopwatch re-arm themselves — their arming
  // effects key on completedSides, which every undo changes.
  const goToPreviousSet = () => {
    if (!advanceArmedRef.current) return;
    const snapshot = setHistory[setHistory.length - 1];
    if (!snapshot) return;
    advanceArmedRef.current = false;

    setSetHistory((prev) => prev.slice(0, -1));
    setCurrentMovementIndex(snapshot.currentMovementIndex);
    setCurrentMovementRungIndex(snapshot.currentMovementRungIndex);
    setIsMirrorSet(snapshot.isMirrorSet);
    setCompletedReps(snapshot.completedReps);
    setCompletedRounds(snapshot.completedRounds);
    setCompletedRungs(snapshot.completedRungs);
    setCompletedSides(snapshot.completedSides);
    setCompletedVolume(snapshot.completedVolume);
    setCompletedRepsByMovement(snapshot.completedRepsByMovement);
    roundSplitsRef.current = roundSplitsRef.current.slice(
      0,
      snapshot.roundSplitsLength,
    );
    setLastLap(snapshot.lastLap);

    // The restored set gets a fresh work period, whether we were resting or
    // mid-interval.
    if (isRestActive) endRest();
    if (intervalTimer > 0) resetIntervalTimer();
  };

  const handleClickPrevious = () => {
    unlockAudio();
    goToPreviousSet();
  };

  // Next only exists where Continue doesn't: the rest, interval, and timed-rung
  // states replace the control slot with a progress bar, leaving no way to
  // advance by hand. When Continue is on screen it already is the way forward.
  const showNextButton =
    !workoutTimerPaused &&
    !isCountdownActive &&
    (isRestActive || intervalTimer > 0 || isTimedRung);

  // Next completes the current set early (counting its planned reps), except
  // during rest, where the set is already counted and only the remaining rest
  // is skipped.
  const handleClickNext = () => {
    unlockAudio();
    if (isRestActive) {
      endRest();
      return;
    }
    if (requiresRepsPrompt) {
      openRepsPrompt();
      return;
    }
    setIsEffectActive(true);
    continueWorkout();
    if (intervalTimer > 0) resetIntervalTimer();
  };

  const handleClickPause = () => pauseWorkout();

  const handleClickFinish = () => finishWorkout();

  useEffect(
    function handleRoundsGoalReached() {
      if (workoutGoalUnits !== 'rounds' || logWorkoutLoading) return;
      if (completedRounds >= workoutGoal) finishWorkout();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires only on each completedRounds tick; finishWorkout and the goal reads must stay fresh without retriggering
    [completedRounds],
  );

  const finishWorkoutRef = useRef(finishWorkout);
  finishWorkoutRef.current = finishWorkout;

  useEffect(
    function handleMinutesGoalReached() {
      if (workoutGoalUnits !== 'minutes' || logWorkoutLoading) return;
      if (remainingMilliseconds > 0) return;
      // small delay for all rounds to be counted from interval timer; the ref
      // keeps the logged counts fresh across that delay
      const grace = setTimeout(() => finishWorkoutRef.current(), 500);
      return () => clearTimeout(grace);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires only on each remainingMilliseconds tick; finishWorkout and the goal reads must stay fresh without retriggering
    [remainingMilliseconds],
  );

  useEffect(
    function handleKilogramsGoalReached() {
      if (workoutGoalUnits !== 'kilograms' || logWorkoutLoading) return;
      if (completedVolume >= workoutGoal) finishWorkout();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires only on each completedVolume tick; finishWorkout and the goal reads must stay fresh without retriggering
    [completedVolume],
  );

  useEffect(
    function handleFinishInterval() {
      if (intervalTimer === 0) return;
      if (intervalRemainingMilliseconds === 0) finishInterval();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires only on each interval tick; finishInterval is recreated per render and must not retrigger this effect
    [intervalRemainingMilliseconds],
  );

  // Re-arm the rung countdown after every advance. Keyed on completedSides
  // because that is the one counter continueWorkout always bumps: a
  // single-movement, single-rung timed workout (a plank) leaves both the
  // movement and rung index at 0, so keying on those would leave the timer
  // parked at zero and refire handleFinishRung forever.
  useEffect(
    function armRungTimer() {
      if (!isTimedRung) return;
      resetRungTimer(currentRungSeconds / 60);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-arms once per advance; resetRungTimer is recreated whenever the rung duration changes and must not retrigger this effect
    [completedSides, currentRungSeconds, isTimedRung],
  );

  // Zero the hold clock on each advance, keyed on completedSides for the same
  // reason armRungTimer is: it is the one counter every continue bumps.
  useEffect(
    function armSetStopwatch() {
      resetSetStopwatch();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-arms once per advance; resetSetStopwatch is recreated whenever the run state flips and must not retrigger this effect
    [completedSides],
  );

  useEffect(
    function handleFinishRung() {
      if (!isTimedRung || intervalTimer > 0) return;
      if (rungRemainingMilliseconds === 0) finishRung();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires only on each rung tick; finishRung is recreated per render and must not retrigger this effect
    [rungRemainingMilliseconds],
  );

  useEffect(
    function handleFinishRest() {
      if (restTimer === 0) return;
      if (restRemainingMilliseconds === 0) finishRest();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires only on each rest tick; finishRest is recreated per render and must not retrigger this effect
    [restRemainingMilliseconds],
  );

  useEffect(
    function handlePageRefresh() {
      if (movements[0].movementName === '') navigate('/'); // todo: handle page refresh with local storage
    },
    [movements, navigate],
  );

  useEffect(
    function handleFinishWorkout() {
      if (workoutLogId)
        navigate(`/history/${workoutLogId}`, {
          state: { justFinished: true },
        });
    },
    [workoutLogId, navigate],
  );

  useEffect(
    function handleCountdownTimer() {
      if (countdownRemainingMilliseconds === 0) finishCountdown();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires only on each countdown tick; finishCountdown is recreated per render and must not retrigger this effect
    [countdownRemainingMilliseconds],
  );

  const showGhost = Boolean(ghostPacingEnabled && ghost && startedAt);

  const lapDeltaMs =
    ghostPacingEnabled && ghost && lastLap
      ? getLapDelta(ghost, lastLap.roundIndex, lastLap.lapMs)
      : null;

  return (
    <Page>
      {/* The rail is absolutely positioned, so it needs a positioned parent and
          room to its left. Both only exist when there is a ghost, leaving the
          markup of an unraced workout exactly as it was. */}
      <div
        className={clsx('flex flex-col gap-2', showGhost && 'relative pl-2')}
      >
        {showGhost && ghost && startedAt && (
          <GhostRail
            ghost={ghost}
            totalRounds={getRailScale({
              workoutGoal,
              workoutGoalUnits,
              ghost,
            })}
            completedRounds={completedRounds}
            startedAt={startedAt}
          />
        )}

        <WorkoutProgress
          onClickCancel={() => setCancelDialogOpen(true)}
          completedRounds={completedRounds}
          completedVolume={completedVolume}
          formattedTimeRemaining={formattedTimeRemaining}
          handleClickPause={handleClickPause}
          remainingMilliseconds={remainingMilliseconds}
          completedSets={setProgress?.completedSets}
          totalSets={setProgress?.totalSets}
          workoutGoal={workoutGoal}
          workoutGoalUnits={workoutGoalUnits}
          workoutTimerPaused={workoutTimerPaused}
        />

        {isComplex ? (
          <ComplexMovementDisplay
            currentRound={currentRound}
            currentSide={currentSide}
            movements={movements}
            rungIndex={currentMovementRungIndex}
            sharedWeightTwoUnit={sharedWeightTwoUnit}
            sharedWeightTwoValue={sharedWeightTwoValue}
            sharedWeightUnit={sharedWeightOneUnit}
            sharedWeightValue={sharedWeightOneValue}
            totalSides={isSingleArmComplex ? totalSides : 1}
          />
        ) : (
          <CurrentMovement
            currentMovement={currentMovement}
            currentRound={currentRound}
            currentSide={currentSide}
            isOneHanded={isOneHanded}
            isTimedRung={isTimedRung}
            isMaxTimedRung={isMaxTimedRung}
            formattedElapsed={formatRungDuration(elapsedMilliseconds / 1000)}
            leftWeightUnit={leftWeightUnit}
            leftWeightValue={leftWeightValue}
            repScheme={currentMovement.repScheme}
            restRemaining={isRestActive}
            rightWeightUnit={rightWeightUnit}
            rightWeightValue={rightWeightValue}
            rungIndex={currentMovementRungIndex}
            movementIndex={currentMovementIndex}
            totalMovements={movements.length}
            totalRungs={isStraightSets ? currentMovementRungs : undefined}
            totalSides={totalSides}
            title={title}
            preWorkoutNotes={preWorkoutNotes}
            hasStarted={hasStarted}
          />
        )}

        {lapDeltaMs !== null && lastLap && (
          <LapDeltaPill deltaMs={lapDeltaMs} lapKey={lastLap.roundIndex} />
        )}

        <div className="flex h-5 items-center justify-center gap-1">
          <Button
            aria-label="Previous set"
            variant="ghost"
            size="lg"
            className="px-1"
            disabled={
              setHistory.length === 0 || workoutTimerPaused || isCountdownActive
            }
            onClick={handleClickPrevious}
          >
            <ChevronLeftIcon className="h-2.5 w-2.5" />
          </Button>
          <ActiveWorkoutControls
            formattedCountdownRemaining={formattedCountdownRemaining}
            formattedIntervalRemaining={formattedIntervalRemaining}
            formattedRestRemaining={formattedRestRemaining}
            canAdjustReps={canAdjustReps}
            handleClickAdjustReps={openRepsPrompt}
            handleClickContinue={handleClickContinue}
            handleClickStart={handleClickStart}
            formattedRungRemaining={formattedRungRemaining}
            intervalCompletedPercentage={intervalCompletedPercentage}
            intervalTimer={intervalTimer}
            isComplexMode={isComplex}
            isCountdownActive={isCountdownActive}
            isEffectActive={isEffectActive}
            isRestActive={isRestActive}
            isTimedRung={isTimedRung}
            restCompletedPercentage={restCompletedPercentage}
            rungCompletedPercentage={rungCompletedPercentage}
            setIsEffectActive={setIsEffectActive}
            workoutTimerPaused={workoutTimerPaused}
          />
          {showNextButton && (
            <Button
              aria-label="Next set"
              variant="ghost"
              size="lg"
              className="px-1"
              onClick={handleClickNext}
            >
              <ChevronRightIcon className="h-2.5 w-2.5" />
            </Button>
          )}
        </div>

        <WorkoutSummary
          completedReps={completedReps}
          completedRounds={completedRounds}
          completedVolume={completedVolume}
          roundsGoal={workoutGoalUnits === 'rounds' ? workoutGoal : undefined}
          roundsLabel={isStraightSets ? 'Sets' : 'Rounds'}
          logWorkoutLoading={logWorkoutLoading}
          onClickFinish={handleClickFinish}
          startedAt={startedAt ?? new Date()}
        />
      </div>

      <RepsCompletedDialog
        open={repsPromptOpen}
        onOpenChange={setRepsPromptOpen}
        movements={promptMovements}
        required={requiresRepsPrompt}
        onConfirm={handleConfirmReps}
      />

      <ConfirmDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        title="Cancel this workout?"
        description="Your progress won't be saved."
        confirmLabel="Discard workout"
        confirmVariant="destructive"
        dismissLabel="Keep going"
        onConfirm={cancelWorkout}
        onDismiss={() => setCancelDialogOpen(false)}
      />

      {features.spotify && <SpotifyMiniPlayer />}
    </Page>
  );
};
