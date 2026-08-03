import { Cross2Icon, PauseIcon } from '@radix-ui/react-icons';

import { Button } from '~/components/ui/button';

import { ProgressBar } from './ProgressBar';

interface WorkoutProgressProps {
  completedRounds: number;
  completedVolume: number;
  formattedTimeRemaining: string;
  handleClickPause: () => void;
  onClickCancel: () => void;
  remainingMilliseconds: number;
  workoutGoal: number;
  workoutGoalUnits: string;
  workoutTimerPaused: boolean;
}

export const WorkoutProgress = ({
  completedRounds,
  completedVolume,
  formattedTimeRemaining,
  handleClickPause,
  onClickCancel,
  remainingMilliseconds,
  workoutGoal,
  workoutGoalUnits,
  workoutTimerPaused,
}: WorkoutProgressProps) => {
  let completedPercentage: number = 0;
  let progressBarDescription: string | undefined;
  let progressBarValue: string | undefined;

  if (workoutGoalUnits === 'minutes') {
    progressBarValue = formattedTimeRemaining;
    const totalMilliseconds = workoutGoal * 60000;
    completedPercentage =
      workoutGoal > 0
        ? ((totalMilliseconds - remainingMilliseconds) / totalMilliseconds) *
          100
        : 0;
    progressBarDescription = 'time remaining';
  }

  if (workoutGoalUnits === 'rounds') {
    progressBarValue = `${workoutGoal - completedRounds}`;
    completedPercentage =
      workoutGoal > 0 ? (completedRounds / workoutGoal) * 100 : 0;
    progressBarDescription = 'rounds remaining';
  }

  if (workoutGoalUnits === 'kilograms') {
    const remainingVolume = Math.max(0, workoutGoal - completedVolume);
    const remainingPercentage =
      workoutGoal > 0 ? (remainingVolume / workoutGoal) * 100 : 0;
    progressBarValue = `${Math.round(remainingPercentage)}%`;
    completedPercentage =
      workoutGoal > 0 ? (completedVolume / workoutGoal) * 100 : 0;
    progressBarDescription = 'volume remaining';
  }

  return (
    <div className="flex w-full items-center gap-1">
      <div>
        <Button
          aria-label="Cancel workout"
          onClick={onClickCancel}
          size="icon"
          variant="ghost"
        >
          <Cross2Icon className="h-3 w-3" />
        </Button>
      </div>

      <ProgressBar
        completedPercentage={workoutGoal > 0 ? completedPercentage : 0}
        description={workoutGoal > 0 ? progressBarDescription : undefined}
        value={workoutGoal > 0 ? progressBarValue : undefined}
      />

      {workoutGoalUnits === 'minutes' && workoutGoal > 0 && (
        <div>
          <Button
            disabled={workoutTimerPaused}
            onClick={handleClickPause}
            size="icon"
            variant="secondary"
          >
            <PauseIcon className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
};
