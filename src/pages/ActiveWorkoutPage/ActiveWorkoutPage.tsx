import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AnalyticsEvent, trackEvent, useLogWorkout } from '~/api';
import { Page, SpotifyMiniPlayer } from '~/components';
import { ConfirmDialog } from '~/components/ConfirmDialog';
import { useProgramSession, useSession, useWorkoutOptions } from '~/contexts';
import { useCountdownTimer, useFeatures } from '~/hooks';
import { playDing, playStartCue, unlockAudio } from '~/utils';

import {
  ActiveWorkoutControls,
  ComplexMovementDisplay,
  CurrentMovement,
  WorkoutProgress,
  WorkoutSummary,
} from './components';
import { useRequestWakeLock } from './hooks';
import { getSetProgress } from './utils';

const LB_TO_KG = 0.453592;

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
    },
  ] = useWorkoutOptions();

  const {
    mutate: logWorkout,
    data: workoutLogId,
    isPending: logWorkoutLoading,
  } = useLogWorkout();

  const navigate = useNavigate();
  const requestWakeLock = useRequestWakeLock();
  const [, setProgramSession] = useProgramSession();
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

  // Timed movements (PROD-200): a timed movement's repScheme holds SECONDS per
  // rung, not reps. The rung runs on its own countdown that auto-fires
  // "continue" on expiry, exactly as intervalTimer does. The builder makes the
  // two mutually exclusive; the effects below also guard, since both would
  // otherwise drive continueWorkout and double-advance.
  const isTimedRung = currentMovement.timedRungs === true;
  const currentRungSeconds = isTimedRung
    ? currentMovement.repScheme[currentMovementRungIndex]
    : 0;

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
  // Seconds are not reps: a timed rung contributes no volume, or a 2-minute
  // carry at 24 kg would log 2,880 kg and end a kilograms-goal workout instantly.
  const currentRungVolume = isTimedRung
    ? 0
    : currentTotalWeight * currentMovement.repScheme[currentMovementRungIndex];

  const isStraightSets = workoutMode === 'straightSets';
  const currentRound = completedRounds + 1;
  const shouldMirrorReps = isOneHanded || isMixedWeights;

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

  const incrementReps = () =>
    setCompletedReps((prev) =>
      isTimedRung
        ? prev
        : prev + currentMovement.repScheme[currentMovementRungIndex],
    );

  const incrementRepsComplex = () =>
    setCompletedReps(
      (prev) =>
        prev +
        movements.reduce((sum, m) => {
          if (m.timedRungs) return sum;
          const repIdx = Math.min(
            currentMovementRungIndex,
            m.repScheme.length - 1,
          );
          return sum + m.repScheme[repIdx];
        }, 0),
    );

  const incrementRungs = () => setCompletedRungs((prev) => prev + 1);

  const incrementSides = () => setCompletedSides((prev) => prev + 1);

  const incrementRounds = () => setCompletedRounds((prev) => prev + 1);

  const incrementVolume = () =>
    setCompletedVolume((prev) => prev + currentRungVolume);

  const incrementVolumeComplex = () => {
    const complexVolume = movements.reduce((sum, m) => {
      if (m.timedRungs) return sum;
      const repIdx = Math.min(currentMovementRungIndex, m.repScheme.length - 1);
      const reps = m.repScheme[repIdx];
      const weight =
        (m.weightOneUnit === 'pounds'
          ? (m.weightOneValue ?? 0) * LB_TO_KG
          : (m.weightOneValue ?? 0)) +
        (m.weightTwoUnit === 'pounds'
          ? (m.weightTwoValue ?? 0) * LB_TO_KG
          : (m.weightTwoValue ?? 0));
      return sum + weight * reps;
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

  const finishRest = () => {
    playDing();
    pauseRestTimer();
    resetRestTimer();
    setIsRestActive(false);
    if (intervalTimer > 0) startIntervalTimer();
    if (hasTimedMovements) startRungTimer();
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

  const continueWorkout = () => {
    if (!advanceArmedRef.current) return;
    advanceArmedRef.current = false;

    requestWakeLock();
    incrementSides(); // each continue completes one side of work
    if (isComplex) {
      incrementRepsComplex();
      incrementVolumeComplex();
      if (isSingleArmComplex) {
        goToNextSideComplex();
      } else {
        goToNextSetComplex();
      }
    } else {
      incrementReps();
      incrementVolume();
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
      completedRounds,
      completedRungs,
      completedSides,
      completedVolume: Math.round(completedVolume),
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

  const handleClickContinue = () => {
    unlockAudio();
    setIsEffectActive(true);
    continueWorkout();
  };

  const handleClickStart = () => {
    unlockAudio();
    startCountdownTimer();
    setIsCountdownActive(true);
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

  return (
    <Page>
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

      <div className="flex h-5 items-center justify-center">
        <ActiveWorkoutControls
          formattedCountdownRemaining={formattedCountdownRemaining}
          formattedIntervalRemaining={formattedIntervalRemaining}
          formattedRestRemaining={formattedRestRemaining}
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
