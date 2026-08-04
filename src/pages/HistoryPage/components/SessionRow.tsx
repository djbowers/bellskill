import { Link } from 'react-router-dom';

import { cn } from '~/lib/utils';
import { WorkoutLog } from '~/types';
import { WORKOUT_MODE_LABELS, formatVolume } from '~/utils';

import { getDuration } from '../../CompletedWorkoutPage/utils';
import {
  INTENSITY_BG,
  INTENSITY_LABEL,
  RPE_INTENSITY,
  getRowDateLabel,
} from '../utils';

export interface SessionRowProps {
  workoutLog: WorkoutLog;
}

export const SessionRow = ({ workoutLog }: SessionRowProps) => {
  const {
    completedReps,
    completedVolume,
    id,
    movements,
    rpe,
    startedAt,
    workoutMode,
  } = workoutLog;

  const movementsLine = movements.join(' · ');
  // The lifter's own name for the session is the most scannable line; fall
  // back to the movement list when the workout wasn't named.
  const title = workoutLog.title?.trim() || movementsLine;

  const volume = completedVolume ?? 0;
  const metric = volume > 0 ? formatVolume(volume) : `${completedReps} reps`;

  const meta = [
    getRowDateLabel(startedAt),
    // Circuit is the default arrangement, so it stays unlabeled.
    workoutMode === 'circuit' ? null : WORKOUT_MODE_LABELS[workoutMode],
    // Already the headline when the session went unnamed.
    title === movementsLine ? null : movementsLine,
  ].filter(Boolean);

  return (
    <Link
      to={`/history/${id}`}
      className="flex min-h-[44px] items-center gap-1 px-1.5 py-1 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{title}</div>
        <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
          {rpe && (
            <span
              className={cn(
                'h-[6px] w-[6px] shrink-0 rounded-full',
                INTENSITY_BG[RPE_INTENSITY[rpe]],
              )}
            >
              <span className="sr-only">
                {INTENSITY_LABEL[RPE_INTENSITY[rpe]]}
              </span>
            </span>
          )}
          <span className="truncate">
            <span className="text-foreground">{meta[0]}</span>
            {meta.length > 1 && ` · ${meta.slice(1).join(' · ')}`}
          </span>
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="text-sm tabular-nums">{metric}</div>
        <div className="text-xs tabular-nums text-muted-foreground">
          {getDuration(startedAt, workoutLog.completedAt)}
        </div>
      </div>
    </Link>
  );
};
