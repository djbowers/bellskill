import clsx from 'clsx';
import { DateTime } from 'luxon';
import { useEffect, useState } from 'react';

import { Button } from '~/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { WorkoutGoalUnits } from '~/types';

const TIME_FORMAT = 'm:ss';

interface WorkoutSummaryProps {
  completedReps: number;
  completedRounds: number;
  completedRungs: number;
  completedSides: number;
  completedVolume: number;
  logWorkoutLoading: boolean;
  onClickFinish: () => void;
  startedAt: Date;
  workoutGoal: number;
  workoutGoalUnits: WorkoutGoalUnits;
}

export const WorkoutSummary = ({
  completedReps,
  completedRounds,
  completedRungs,
  completedSides,
  completedVolume,
  logWorkoutLoading,
  onClickFinish,
  startedAt,
  workoutGoal,
  workoutGoalUnits,
}: WorkoutSummaryProps) => {
  const [formattedElapsed, setFormattedElapsed] = useState(() =>
    getFormattedElapsed(startedAt),
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setFormattedElapsed(getFormattedElapsed(startedAt));
    }, 1000);

    return () => clearInterval(timer);
  }, [startedAt]);

  return (
    <Card
      className="border-transparent bg-accent"
      data-testid="completed-section"
    >
      <CardHeader className="text-center">
        <CardTitle>Workout Summary</CardTitle>
        {workoutGoal > 0 && (
          <CardDescription>
            Goal: {workoutGoal} {workoutGoalUnits}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="flex items-center justify-between gap-2">
        <CompletedItem label="Elapsed" value={formattedElapsed} align="left" />
        <CompletedItem label="Rounds" value={completedRounds} />
        <CompletedItem label="Rungs" value={completedRungs} />
        <CompletedItem label="Sides" value={completedSides} />
        <CompletedItem label="Reps" value={completedReps} />
        <CompletedItem
          label="Volume"
          value={Math.round(completedVolume)}
          unit="kg"
        />
      </CardContent>

      <CardFooter className="flex items-center justify-center">
        <Button
          disabled={logWorkoutLoading}
          variant="ghost"
          onClick={onClickFinish}
          className="w-full"
        >
          Finish workout
        </Button>
      </CardFooter>
    </Card>
  );
};

const CompletedItem = ({
  label,
  value,
  align = 'right',
  unit,
}: {
  label: string;
  value: string | number;
  align?: 'left' | 'center' | 'right';
  unit?: string;
}) => (
  <div
    className={clsx(
      'flex flex-col justify-center gap-0.5',
      align === 'left' && 'items-start',
      align === 'center' && 'items-center',
      align === 'right' && 'items-end',
    )}
  >
    <div className="text-sm text-muted-foreground">{label}</div>
    <div className="text-lg font-semibold">
      {value}{' '}
      <span className="text-sm font-medium text-muted-foreground">{unit}</span>
    </div>
  </div>
);

const getFormattedElapsed = (startedAt: Date) => {
  return DateTime.now()
    .diff(DateTime.fromJSDate(startedAt))
    .toFormat(TIME_FORMAT);
};
