import { Loading } from '~/components';
import { Badge } from '~/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { MovementLog, WeightUnit } from '~/types';

import {
  getDisplayDate,
  getRepSchemeDisplayValue,
  getTimeRange,
  getWeightsDisplayValue,
  resolveSharedWeights,
} from '../utils';
import { CatalogedBadge } from './CatalogedBadge';
import { LinkMovementDialog } from './LinkMovementDialog';

export interface WorkoutHistoryItemProps {
  completedAt: Date;
  complexSet?: boolean | null;
  intervalTimer: number;
  movementLogs: MovementLog[];
  movementLogsLoading: boolean;
  restTimer: number;
  sharedWeightOneUnit?: WeightUnit | null;
  sharedWeightOneValue?: number | null;
  sharedWeightTwoUnit?: WeightUnit | null;
  sharedWeightTwoValue?: number | null;
  startedAt: Date;
  workoutDetails: string | null;
  workoutGoal: number;
  workoutGoalUnits: string;
  workoutLogId: number;
}

export const WorkoutHistoryItem = ({
  completedAt,
  complexSet,
  intervalTimer,
  movementLogs,
  movementLogsLoading,
  restTimer,
  sharedWeightOneUnit,
  sharedWeightOneValue,
  sharedWeightTwoUnit,
  sharedWeightTwoValue,
  startedAt,
  workoutDetails,
  workoutGoal,
  workoutGoalUnits,
  workoutLogId,
}: WorkoutHistoryItemProps) => {
  const displayDate = getDisplayDate(completedAt);
  const timeRange = getTimeRange(startedAt, completedAt);
  const isComplexSet = complexSet === true;
  const sharedWeights = resolveSharedWeights(
    sharedWeightOneValue,
    sharedWeightOneUnit,
    sharedWeightTwoValue,
    sharedWeightTwoUnit,
    movementLogs,
  );

  return (
    <Card data-testid="workout-history-item">
      <CardHeader>
        <CardTitle className="flex items-baseline justify-between gap-1">
          <div className="flex items-baseline gap-1">
            {displayDate}
            {isComplexSet && <Badge variant="secondary">Complex</Badge>}
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
        {intervalTimer > 0 && (
          <div className="grow text-right">
            <CardDescription id="intervals">Intervals</CardDescription>
            <div aria-labelledby="intervals">{`${intervalTimer}s`}</div>
          </div>
        )}
        {restTimer > 0 && (
          <div className="grow text-right">
            <CardDescription id="rest">Rest</CardDescription>
            <div aria-labelledby="rest">{`${restTimer}s`}</div>
          </div>
        )}
      </CardContent>

      {movementLogsLoading ? (
        <div className="flex justify-center p-3">
          <Loading />
        </div>
      ) : (
        <>
          {isComplexSet && (
            <CardContent>
              <CardDescription id="shared-weight">
                Shared Weight
              </CardDescription>
              <div aria-labelledby="shared-weight">
                {getWeightsDisplayValue(
                  sharedWeights.weightOneValue,
                  sharedWeights.weightOneUnit,
                  sharedWeights.weightTwoValue,
                  sharedWeights.weightTwoUnit,
                )}
              </div>
            </CardContent>
          )}
          {movementLogs.map((movement, index) => (
            <CardContent key={movement.id}>
              <div
                className={`grid gap-2 ${isComplexSet ? 'grid-cols-2' : 'grid-cols-3'}`}
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <CardDescription>Movement #{index + 1}</CardDescription>
                  <div className="flex flex-col gap-0.5">
                    <div>{movement.movementName}</div>
                    <div className="flex gap-1">
                      {movement.functionalMovementId !== null ? (
                        <CatalogedBadge
                          movementLogId={movement.id}
                          workoutLogId={workoutLogId}
                        />
                      ) : (
                        <LinkMovementDialog
                          workoutLogId={workoutLogId}
                          movementLog={movement}
                          movementIndex={index}
                          complexSet={isComplexSet}
                          sharedWeights={sharedWeights}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {!isComplexSet && (
                  <div className="flex flex-col gap-0.5 text-right">
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
                )}
                <div className="flex flex-col gap-0.5 text-right">
                  <CardDescription
                    id="rep-scheme"
                    className="whitespace-nowrap"
                  >
                    Rep Scheme
                  </CardDescription>
                  <div aria-labelledby="rep-scheme">
                    {getRepSchemeDisplayValue(
                      movement.repScheme,
                      isComplexSet
                        ? [
                            sharedWeights.weightOneValue,
                            sharedWeights.weightTwoValue,
                          ]
                        : [movement.weightOneValue, movement.weightTwoValue],
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          ))}
        </>
      )}
    </Card>
  );
};
