import clsx from 'clsx';
import { DateTime } from 'luxon';
import { useEffect, useState } from 'react';

import { Button } from '~/components/ui/button';

const TIME_FORMAT = 'm:ss';

interface WorkoutSummaryProps {
  completedReps: number;
  completedRounds: number;
  completedVolume: number;
  logWorkoutLoading: boolean;
  onClickFinish: () => void;
  startedAt: Date;
}

export const WorkoutSummary = ({
  completedReps,
  completedRounds,
  completedVolume,
  logWorkoutLoading,
  onClickFinish,
  startedAt,
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
    <div className="flex flex-col gap-2" data-testid="completed-section">
      <div className="flex items-center justify-between rounded-md bg-accent px-2 py-1 text-accent-foreground">
        <CompletedItem label="Elapsed" value={formattedElapsed} align="left" />
        <CompletedItem label="Rounds" value={completedRounds} />
        <CompletedItem label="Reps" value={completedReps} />
        <CompletedItem
          label="Volume"
          value={Math.round(completedVolume)}
          unit="kg"
        />
      </div>

      <Button
        disabled={logWorkoutLoading}
        variant="ghost"
        onClick={onClickFinish}
        className="w-full text-muted-foreground"
      >
        Finish workout
      </Button>
    </div>
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
      {value}
      {unit && (
        <span className="text-sm font-medium text-muted-foreground">
          {' '}
          {unit}
        </span>
      )}
    </div>
  </div>
);

const getFormattedElapsed = (startedAt: Date) => {
  return DateTime.now()
    .diff(DateTime.fromJSDate(startedAt))
    .toFormat(TIME_FORMAT);
};
