import { PlayIcon, PlusIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';

import { Button } from '~/components/ui/button';

import { ProgressBar } from './ProgressBar';

interface ActiveWorkoutControlsProps {
  formattedCountdownRemaining: string;
  formattedIntervalRemaining: string;
  formattedRestRemaining: string;
  formattedRungRemaining?: string;
  handleClickContinue: () => void;
  handleClickStart: () => void;
  intervalCompletedPercentage: number;
  intervalTimer: number;
  isComplexMode: boolean;
  isCountdownActive: boolean;
  isEffectActive: boolean;
  isRestActive: boolean;
  isTimedRung?: boolean;
  restCompletedPercentage: number;
  rungCompletedPercentage?: number;
  setIsEffectActive: (isActive: boolean) => void;
  workoutTimerPaused: boolean;
}

export const ActiveWorkoutControls = ({
  formattedCountdownRemaining,
  formattedIntervalRemaining,
  formattedRestRemaining,
  formattedRungRemaining = '0.0',
  handleClickContinue,
  handleClickStart,
  intervalCompletedPercentage,
  intervalTimer,
  isComplexMode,
  isCountdownActive,
  isEffectActive,
  isRestActive,
  isTimedRung = false,
  restCompletedPercentage,
  rungCompletedPercentage = 0,
  setIsEffectActive,
  workoutTimerPaused,
}: ActiveWorkoutControlsProps) => {
  if (isCountdownActive) {
    return (
      <div className="flex items-center justify-center">
        <div className="flex h-6 w-6 items-center justify-center font-mono text-5xl font-medium">
          {parseFloat(formattedCountdownRemaining).toFixed(1)}
        </div>
      </div>
    );
  }

  if (workoutTimerPaused) {
    return (
      <Button onClick={handleClickStart} size="lg" className="grow">
        <PlayIcon className="h-3 w-3" />
      </Button>
    );
  }

  if (isRestActive) {
    return (
      <ProgressBar
        color="warning"
        completedPercentage={restCompletedPercentage}
        size="large"
        description="rest"
        value={parseFloat(formattedRestRemaining).toFixed(1)}
      />
    );
  }

  if (intervalTimer > 0) {
    return (
      <ProgressBar
        color="success"
        completedPercentage={intervalCompletedPercentage}
        size="large"
        description="interval"
        value={parseFloat(formattedIntervalRemaining).toFixed(1)}
      />
    );
  }

  if (isTimedRung) {
    return (
      <ProgressBar
        color="success"
        completedPercentage={rungCompletedPercentage}
        size="large"
        description="time"
        value={parseFloat(formattedRungRemaining).toFixed(1)}
      />
    );
  }

  return (
    <Button
      className={clsx('grow', { 'animate-wiggle': isEffectActive })}
      disabled={workoutTimerPaused}
      onAnimationEnd={() => setIsEffectActive(false)}
      onClick={handleClickContinue}
      size="lg"
    >
      <PlusIcon className="mr-1 h-2.5 w-2.5 stroke-2" />{' '}
      {isComplexMode ? 'Complete Set' : 'Continue'}
    </Button>
  );
};
