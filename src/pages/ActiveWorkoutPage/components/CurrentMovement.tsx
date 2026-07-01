import clsx from 'clsx';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { MovementOptions, WeightUnit } from '~/types';
import { getWeightUnitLabel } from '~/utils';

interface CurrentMovementProps {
  currentMovement: MovementOptions;
  currentRound: number;
  currentSide: number;
  isOneHanded: boolean | null;
  leftWeightUnit: WeightUnit | null;
  leftWeightValue: number | null;
  repScheme: number[];
  restRemaining: boolean;
  rightWeightUnit: WeightUnit | null;
  rightWeightValue: number | null;
  rungIndex: number;
  totalSides: number;
  workoutDetails: string | null;
}

export const CurrentMovement = ({
  currentMovement,
  currentRound,
  currentSide,
  isOneHanded,
  leftWeightUnit,
  leftWeightValue,
  repScheme,
  restRemaining,
  rightWeightUnit,
  rightWeightValue,
  rungIndex,
  totalSides,
  workoutDetails,
}: CurrentMovementProps) => {
  const isThreeColumn = isOneHanded || rightWeightValue;

  return (
    <Card>
      <CardHeader>
        <div className="flex gap-2">
          <CardTitle>
            <div className="flex h-full flex-col items-center justify-center gap-0.5">
              Round
              <div className="relative h-4 w-4 rounded-md bg-accent text-accent-foreground">
                <div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-bold"
                  data-testid="current-round"
                >
                  {currentRound}
                </div>
              </div>
            </div>
          </CardTitle>

          <div className="flex grow flex-col justify-center gap-1">
            <div className="text-2xl font-medium">
              {currentMovement.movementName}
            </div>
            <div className="font-medium text-muted-foreground">
              {workoutDetails}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-1">
          {totalSides > 1 && (
            <CardDescription className="text-center" data-testid="current-side">
              Side {currentSide} of {totalSides}
            </CardDescription>
          )}

          <div
            className={clsx(
              'grid items-center gap-3 text-center',
              isThreeColumn ? 'grid-cols-3' : 'grid-cols-2',
            )}
          >
            <CardDescription>
              {isThreeColumn ? 'Left' : 'Weight'}
            </CardDescription>
            <CardDescription>Reps</CardDescription>
            {isThreeColumn && <CardDescription>Right</CardDescription>}
          </div>

          <div
            className={clsx(
              'grid items-center gap-3 text-center font-medium',
              isThreeColumn ? 'grid-cols-3' : 'grid-cols-2',
            )}
          >
            {leftWeightValue && !restRemaining ? (
              <div className="flex items-end justify-center gap-1">
                <div className="text-3xl" data-testid="left-weight">
                  {Math.round(leftWeightValue)}
                </div>
                <div className="text-lg text-muted-foreground">
                  {getWeightUnitLabel(leftWeightUnit)}
                </div>
              </div>
            ) : (
              <div data-testid="left-weight" />
            )}

            <div
              className="flex items-end justify-center text-3xl"
              data-testid="current-reps"
            >
              {restRemaining ? <span className="h-5" /> : repScheme[rungIndex]}
            </div>

            {rightWeightValue && !restRemaining ? (
              <div className="flex items-end justify-center gap-1">
                <div className="text-3xl" data-testid="right-weight">
                  {Math.round(rightWeightValue)}
                </div>
                <div className="text-lg text-muted-foreground">
                  {getWeightUnitLabel(rightWeightUnit)}
                </div>
              </div>
            ) : (
              <div data-testid="right-weight" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
