import { ScaleIcon } from '@heroicons/react/24/outline';

import { Loading } from '~/components';
import { Badge } from '~/components/ui/badge';
import { MovementLog, WeightUnit } from '~/types';

import {
  formatCarriedWeights,
  formatMovementWeightLine,
  getCompactRepScheme,
  getGoalPillLabel,
  getMovementTotalReps,
  getMovementVolume,
  resolveSharedWeights,
} from '../utils';
import { CatalogedBadge } from './CatalogedBadge';
import { LinkMovementDialog } from './LinkMovementDialog';

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

const TheWorkDivider = () => (
  <div className="flex items-center gap-2 py-2">
    <div className="h-px flex-1 bg-border" />
    <span className="text-xs uppercase tracking-wide text-muted-foreground">
      The work
    </span>
    <div className="h-px flex-1 bg-border" />
  </div>
);

export const WorkoutHistoryItem = ({
  completedReps,
  completedRounds,
  completedVolume,
  complexSet,
  movementLogs,
  movementLogsLoading,
  sharedWeightOneUnit,
  sharedWeightOneValue,
  sharedWeightTwoUnit,
  sharedWeightTwoValue,
  workoutDetails,
  workoutGoal,
  workoutGoalUnits,
  workoutLogId,
}: WorkoutHistoryItemProps) => {
  const isComplexSet = complexSet === true;
  const sharedWeights = resolveSharedWeights(
    sharedWeightOneValue,
    sharedWeightOneUnit,
    sharedWeightTwoValue,
    sharedWeightTwoUnit,
    movementLogs,
  );
  const goalPillLabel = getGoalPillLabel(workoutGoal, workoutGoalUnits);

  return (
    <div className="flex flex-col gap-2" data-testid="workout-history-item">
      <div className="relative">
        <Badge
          variant="outline"
          className="absolute right-0 top-0 text-xs uppercase tracking-wide"
        >
          {goalPillLabel}
        </Badge>

        <p className="text-xs text-muted-foreground">You moved</p>
        <div className="flex items-baseline gap-1">
          <span className="text-5xl font-medium leading-none">
            {completedVolume.toLocaleString()}
          </span>
          <span className="text-sm text-muted-foreground">kg</span>
        </div>
        <p className="text-sm text-muted-foreground">
          across {completedRounds} rounds · {completedReps} reps
        </p>
      </div>

      {workoutDetails && (
        <p className="text-sm italic text-muted-foreground">{workoutDetails}</p>
      )}

      <TheWorkDivider />

      {movementLogsLoading ? (
        <div className="flex justify-center py-3">
          <Loading />
        </div>
      ) : (
        <div className="flex flex-col">
          {movementLogs.map((movement, index) => {
            const totalReps = getMovementTotalReps(
              movement.repScheme,
              completedRounds,
            );
            const movementVolume = getMovementVolume(
              movement,
              completedRounds,
            );
            const weightLine = formatMovementWeightLine(movement);
            const repSchemeLine = getCompactRepScheme(
              movement.repScheme,
              completedRounds,
            );
            const isLinked = movement.functionalMovementId !== null;

            return (
              <div key={movement.id}>
                {index > 0 && <div className="h-px bg-border" />}
                <div className="flex gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex gap-2">
                      <span className="shrink-0 italic text-muted-foreground">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{movement.movementName}</p>
                        {!isComplexSet && weightLine && (
                          <p className="flex items-center gap-0.5 text-sm text-muted-foreground">
                            <ScaleIcon className="h-2 w-2 shrink-0" />
                            <span>
                              {weightLine}
                              <span className="mx-0.5">·</span>
                              {repSchemeLine}
                            </span>
                          </p>
                        )}
                        {!isComplexSet && !weightLine && (
                          <p className="text-sm text-muted-foreground">
                            {repSchemeLine}
                          </p>
                        )}
                        {isComplexSet && (
                          <p className="text-sm text-muted-foreground">
                            {repSchemeLine}
                          </p>
                        )}
                        <div className="mt-0.5">
                          {isLinked ? (
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
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-2xl italic">{`×${totalReps}`}</p>
                    {!isComplexSet && movementVolume !== null && (
                      <p className="text-sm text-muted-foreground">
                        {movementVolume.toLocaleString()} kg
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {isComplexSet && (
            <div className="mt-1 border-t border-border pt-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide underline">
                    Carried
                  </p>
                  <p className="text-sm">
                    {formatCarriedWeights(
                      sharedWeights.weightOneValue,
                      sharedWeights.weightOneUnit,
                      sharedWeights.weightTwoValue,
                      sharedWeights.weightTwoUnit,
                    )}
                  </p>
                </div>
                <p className="text-right text-xs italic text-muted-foreground">
                  shared across the complex
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
