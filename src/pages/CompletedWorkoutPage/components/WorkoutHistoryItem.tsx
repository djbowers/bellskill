import { DateTime, Duration } from 'luxon';

import { Loading } from '~/components';
import { Badge } from '~/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { Separator } from '~/components/ui/separator';
import { MovementLog } from '~/types';

import {
  getDisplayDate,
  getDuration,
  getRepSchemeDisplayValue,
  getTimeRange,
  getWeightsDisplayValue,
} from '../utils';

export interface WorkoutHistoryItemProps {
  completedAt: Date;
  completedReps: number;
  completedRounds: number;
  completedRungs: number;
  completedVolume: number;
  complexSet?: boolean | null;
  intervalTimer: number;
  movementLogs: MovementLog[];
  movementLogsLoading: boolean;
  restTimer: number;
  startedAt: Date;
  workoutDetails: string | null;
  workoutGoal: number;
  workoutGoalUnits: string;
}

export const WorkoutHistoryItem = ({
  completedAt,
  completedReps,
  completedRounds,
  completedRungs,
  completedVolume,
  complexSet,
  intervalTimer,
  movementLogs,
  movementLogsLoading,
  restTimer,
  startedAt,
  workoutDetails,
  workoutGoal,
  workoutGoalUnits,
}: WorkoutHistoryItemProps) => {
  const displayDate = getDisplayDate(completedAt);
  const duration = getDuration(startedAt, completedAt);
  const timeRange = getTimeRange(startedAt, completedAt);

  return (
    <Card data-testid="workout-history-item">
      <CardHeader>
        <CardTitle className="flex items-baseline justify-between gap-1">
          <div className="flex items-baseline gap-1">
            {displayDate}
            {complexSet === true && (
              <Badge variant="secondary">Complex</Badge>
            )}
          </div>
          <CardDescription className="text-xs">{timeRange}</CardDescription>
        </CardTitle>
        {workoutDetails && (
          <CardDescription className="italic">{workoutDetails}</CardDescription>
        )}
      </CardHeader>

      <CardContent className="flex gap-2">
        <div className="grow">
          <CardDescription id="goal">Goal</CardDescription>
          <div aria-labelledby="goal">
            {workoutGoalUnits === 'kilograms'
              ? `${workoutGoal} kg`
              : workoutGoalUnits === 'minutes'
                ? `${workoutGoal}m`
                : `${workoutGoal} ${workoutGoalUnits}`}
          </div>
        </div>
        <div className="grow text-right">
          <CardDescription id="intervals">Intervals</CardDescription>
          <div aria-labelledby="intervals">
            {intervalTimer > 0 ? `${intervalTimer}s` : 'None'}
          </div>
        </div>
        <div className="grow text-right">
          <CardDescription id="rest">Rest</CardDescription>
          <div aria-labelledby="rest">
            {restTimer > 0 ? `${restTimer}s` : 'None'}
          </div>
        </div>
      </CardContent>

      {movementLogsLoading ? (
        <div className="flex justify-center p-3">
          <Loading />
        </div>
      ) : (
        movementLogs.map((movement, index) => (
          <CardContent key={movement.id}>
            <div className="flex gap-2">
              <div className="grow">
                <CardDescription>Movement #{index + 1}</CardDescription>
                <div>{movement.movementName}</div>
              </div>
              <div className="grow text-right">
                <CardDescription id="weights">Weights</CardDescription>
                <div aria-labelledby="weights">
                  {getWeightsDisplayValue(
                    movement.weightOneValue,
                    movement.weightOneUnit,
                    movement.weightTwoValue,
                    movement.weightTwoUnit,
                  )}
                </div>
              </div>
              <div className="grow text-right">
                <CardDescription id="rep-scheme">Rep Scheme</CardDescription>
                <div aria-labelledby="rep-scheme">
                  {getRepSchemeDisplayValue(movement.repScheme, [
                    movement.weightOneValue,
                    movement.weightTwoValue,
                  ])}
                </div>
              </div>
            </div>
          </CardContent>
        ))
      )}

      <CardContent>
        <Separator />
      </CardContent>

      <CardContent>
        <CardTitle>Workout Summary</CardTitle>
      </CardContent>

      <CardFooter className="flex gap-2">
        <div className="grow">
          <CardDescription id="elapsed">Elapsed</CardDescription>
          <div aria-labelledby="elapsed">{duration}</div>
        </div>
        <div className="grow text-right">
          <CardDescription id="rounds">Rounds</CardDescription>
          <div aria-labelledby="rounds">{completedRounds}</div>
        </div>
        <div className="grow text-right">
          <CardDescription id="rungs">Rungs</CardDescription>
          <div aria-labelledby="rungs">{completedRungs}</div>
        </div>
        <div className="grow text-right">
          <CardDescription id="reps">Reps</CardDescription>
          <div aria-labelledby="reps">{completedReps}</div>
        </div>
        <div className="grow text-right">
          <CardDescription id="volume">Volume</CardDescription>
          <div aria-labelledby="volume">
            {completedVolume > 0 ? `${completedVolume} kg` : 'N/A'}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
};
