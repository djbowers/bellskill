import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useLogWorkout } from '~/api';
import { Page } from '~/components';
import { useWorkoutOptions } from '~/contexts';
import { useCountdownTimer } from '~/hooks';

import {
  ActiveWorkoutControls,
  ComplexMovementDisplay,
  CurrentMovement,
  WorkoutProgress,
  WorkoutSummary,
} from './components';
import { useRequestWakeLock } from './hooks';

const LB_TO_KG = 0.453592;

interface ActiveWorkoutPageProps {
  defaultPaused?: boolean;
}

export const ActiveWorkoutPage = ({
  defaultPaused = true,
}: ActiveWorkoutPageProps) => {
  const [
    {
      complexSet,
      intervalTimer,
      movements,
      restTimer,
      sharedWeightOneUnit,
      sharedWeightOneValue,
      sharedWeightTwoUnit,
      sharedWeightTwoValue,
      startedAt,
      workoutDetails,
      workoutGoal,
      workoutGoalUnits,
    },
  ] = useWorkoutOptions();

  const {
    mutate: logWorkout,
    data: workoutLogId,
    isLoading: logWorkoutLoading,
  } = useLogWorkout();

  const navigate = useNavigate();
  const requestWakeLock = useRequestWakeLock();

  const [
    formattedTimeRemaining,
    {
      milliseconds: remainingMilliseconds,
      pause: pauseWorkoutTimer,
      paused: workoutTimerPaused,
      play: startWorkoutTimer,
    },
  ] = useCountdownTimer(workoutGoal, {
    defaultPaused:
      defaultPaused &&
      ((workoutGoalUnits === 'minutes' && workoutGoal > 0) ||
        intervalTimer > 0),
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
  const [completedVolume, setCompletedVolume] = useState<number>(0);

  const [isMirrorSet, setIsMirrorSet] = useState<boolean>(false); // for one-handed movements and mixed weights
  const [isEffectActive, setIsEffectActive] = useState<boolean>(false);
  const [isRestActive, setIsRestActive] = useState<boolean>(false);
  const [isCountdownActive, setIsCountdownActive] = useState<boolean>(false);

  // Movements
  const lastMovementIndex = movements.length - 1;
  const isLastMovement = currentMovementIndex === lastMovementIndex;
  const currentMovement = movements[currentMovementIndex];

  // Weights
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

  // Rungs
  const currentMovementRungs = currentMovement.repScheme.length;
  const isLastRung = currentMovementRungIndex === currentMovementRungs - 1;
  const currentRungVolume =
    currentTotalWeight * currentMovement.repScheme[currentMovementRungIndex];

  // Rounds
  const currentRound = completedRounds + 1;
  const shouldMirrorReps = isOneHanded || isMixedWeights;

  // Interval Timer
  const totalIntervalMilliseconds = intervalTimer * 1000;
  const intervalCompletedPercentage =
    ((totalIntervalMilliseconds - intervalRemainingMilliseconds) /
      totalIntervalMilliseconds) *
    100;

  // Rest Timer
  const totalRestMilliseconds = restTimer * 1000;
  const restCompletedPercentage =
    ((totalRestMilliseconds - restRemainingMilliseconds) /
      totalRestMilliseconds) *
    100;

  // Complex mode: round completes when the longest movement's final rung is done
  const maxMovementRungs = complexSet
    ? Math.max(...movements.map((m) => m.repScheme.length))
    : currentMovementRungs;

  // Helper Functions
  const incrementReps = () =>
    setCompletedReps(
      (prev) => prev + currentMovement.repScheme[currentMovementRungIndex],
    );

  const incrementRepsComplex = () =>
    setCompletedReps(
      (prev) =>
        prev +
        movements.reduce((sum, m) => {
          const repIdx = Math.min(
            currentMovementRungIndex,
            m.repScheme.length - 1,
          );
          return sum + m.repScheme[repIdx];
        }, 0),
    );

  const incrementRungs = () => setCompletedRungs((prev) => prev + 1);

  const incrementRounds = () => setCompletedRounds((prev) => prev + 1);

  const incrementVolume = () =>
    setCompletedVolume((prev) => prev + currentRungVolume);

  const incrementVolumeComplex = () => {
    const complexVolume = movements.reduce((sum, m) => {
      const repIdx = Math.min(
        currentMovementRungIndex,
        m.repScheme.length - 1,
      );
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

  const goToNextMovement = () => {
    if (isLastMovement) {
      setCurrentMovementIndex(0);
      goToNextRung();
    } else {
      setCurrentMovementIndex((prev) => prev + 1);
    }
  };

  const goToNextSide = () => {
    if (isMirrorSet) {
      setIsMirrorSet(false);
      goToNextMovement();
    } else {
      setIsMirrorSet(true);
    }
  };

  const goToNextSet = () => {
    if (shouldMirrorReps) {
      goToNextSide();
    } else {
      goToNextMovement();
    }
  };

  const startRest = () => {
    setIsRestActive(true);
    startRestTimer();
    if (intervalTimer > 0) pauseIntervalTimer();
  };

  const finishRest = () => {
    pauseRestTimer();
    resetRestTimer();
    setIsRestActive(false);
    if (intervalTimer > 0) startIntervalTimer();
  };

  const finishInterval = () => {
    continueWorkout();
    resetIntervalTimer();
  };

  const continueWorkout = () => {
    requestWakeLock();
    if (complexSet) {
      incrementRepsComplex();
      incrementVolumeComplex();
      goToNextSetComplex();
    } else {
      incrementReps();
      incrementVolume();
      goToNextSet();
    }
    if (restTimer > 0) startRest();
  };

  const finishCountdown = () => {
    pauseCountdownTimer();
    setIsCountdownActive(false);
    resetCountdownTimer();
    startWorkoutTimer();
    if (intervalTimer > 0 && !isRestActive) startIntervalTimer();
    if (isRestActive) startRestTimer();
  };

  const pauseWorkout = () => {
    pauseWorkoutTimer();
    pauseIntervalTimer();
    if (isRestActive) pauseRestTimer();
  };

  const finishWorkout = () => {
    if (logWorkoutLoading) return;

    pauseWorkout();
    logWorkout({
      completedReps,
      completedRounds,
      completedRungs,
      completedVolume: Math.round(completedVolume),
    });
  };

  // Event Handlers
  const handleClickContinue = () => {
    setIsEffectActive(true);
    continueWorkout();
  };

  const handleClickStart = () => {
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
    [completedRounds],
  );

  useEffect(
    function handleMinutesGoalReached() {
      if (workoutGoalUnits !== 'minutes' || logWorkoutLoading) return;
      // small delay for all rounds to be counted from interval timer
      if (remainingMilliseconds <= -500) finishWorkout();
    },
    [remainingMilliseconds],
  );

  useEffect(
    function handleKilogramsGoalReached() {
      if (workoutGoalUnits !== 'kilograms' || logWorkoutLoading) return;
      if (completedVolume >= workoutGoal) finishWorkout();
    },
    [completedVolume],
  );

  useEffect(
    function handleFinishInterval() {
      if (intervalTimer === 0) return;
      if (intervalRemainingMilliseconds === 0) finishInterval();
    },
    [intervalRemainingMilliseconds],
  );

  useEffect(
    function handleFinishRest() {
      if (restTimer === 0) return;
      if (restRemainingMilliseconds === 0) finishRest();
    },
    [restRemainingMilliseconds],
  );

  useEffect(
    function handlePageRefresh() {
      if (movements[0].movementName === '') navigate('/'); // todo: handle page refresh with local storage
    },
    [movements],
  );

  useEffect(
    function handleFinishWorkout() {
      if (workoutLogId) navigate(`/history/${workoutLogId}`);
    },
    [workoutLogId],
  );

  useEffect(
    function handleCountdownTimer() {
      if (countdownRemainingMilliseconds === 0) finishCountdown();
    },
    [countdownRemainingMilliseconds],
  );

  return (
    <Page>
      <WorkoutProgress
        completedRounds={completedRounds}
        completedVolume={completedVolume}
        formattedTimeRemaining={formattedTimeRemaining}
        handleClickPause={handleClickPause}
        remainingMilliseconds={remainingMilliseconds}
        workoutGoal={workoutGoal}
        workoutGoalUnits={workoutGoalUnits}
        workoutTimerPaused={workoutTimerPaused}
      />

      {complexSet ? (
        <ComplexMovementDisplay
          currentRound={currentRound}
          movements={movements}
          rungIndex={currentMovementRungIndex}
          sharedWeightTwoUnit={sharedWeightTwoUnit}
          sharedWeightTwoValue={sharedWeightTwoValue}
          sharedWeightUnit={sharedWeightOneUnit}
          sharedWeightValue={sharedWeightOneValue}
        />
      ) : (
        <CurrentMovement
          currentMovement={currentMovement}
          currentRound={currentRound}
          isOneHanded={isOneHanded}
          leftWeightUnit={leftWeightUnit}
          leftWeightValue={leftWeightValue}
          repScheme={currentMovement.repScheme}
          restRemaining={isRestActive}
          rightWeightUnit={rightWeightUnit}
          rightWeightValue={rightWeightValue}
          rungIndex={currentMovementRungIndex}
          workoutDetails={workoutDetails}
        />
      )}

      <div className="flex h-5 items-center justify-center">
        <ActiveWorkoutControls
          formattedCountdownRemaining={formattedCountdownRemaining}
          formattedIntervalRemaining={formattedIntervalRemaining}
          formattedRestRemaining={formattedRestRemaining}
          handleClickContinue={handleClickContinue}
          handleClickStart={handleClickStart}
          intervalCompletedPercentage={intervalCompletedPercentage}
          intervalTimer={intervalTimer}
          isComplexMode={complexSet}
          isCountdownActive={isCountdownActive}
          isEffectActive={isEffectActive}
          isRestActive={isRestActive}
          restCompletedPercentage={restCompletedPercentage}
          setIsEffectActive={setIsEffectActive}
          workoutTimerPaused={workoutTimerPaused}
        />
      </div>

      <WorkoutSummary
        completedReps={completedReps}
        completedRounds={completedRounds}
        completedRungs={completedRungs}
        completedVolume={completedVolume}
        logWorkoutLoading={logWorkoutLoading}
        onClickFinish={handleClickFinish}
        startedAt={startedAt ?? new Date()}
        workoutGoal={workoutGoal}
        workoutGoalUnits={workoutGoalUnits}
      />
    </Page>
  );
};
