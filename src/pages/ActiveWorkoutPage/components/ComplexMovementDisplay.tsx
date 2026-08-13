import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { MovementOptions, WeightUnit } from '~/types';
import { formatRungDuration, getWeightUnitLabel } from '~/utils';

interface ComplexMovementDisplayProps {
  currentRound: number;
  currentSide?: number;
  movements: MovementOptions[];
  rungIndex: number;
  sharedWeightTwoUnit: WeightUnit | null;
  sharedWeightTwoValue: number | null;
  sharedWeightUnit: WeightUnit | null;
  sharedWeightValue: number | null;
  totalSides?: number;
}

export const ComplexMovementDisplay = ({
  currentRound,
  currentSide = 1,
  movements,
  rungIndex,
  sharedWeightTwoUnit,
  sharedWeightTwoValue,
  sharedWeightUnit,
  sharedWeightValue,
  totalSides = 1,
}: ComplexMovementDisplayProps) => {
  const hasWeightOne = sharedWeightValue !== null && sharedWeightValue > 0;
  const hasWeightTwo =
    sharedWeightTwoValue !== null && sharedWeightTwoValue > 0;

  // Single-arm complex: the whole chain is done on one hand, then the other on
  // the next set. currentSide 1 = left, 2 = right.
  const activeHand = currentSide === 1 ? 'Left' : 'Right';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
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

          {hasWeightOne && (
            <div className="flex items-end gap-1">
              <div
                className="text-3xl font-medium"
                data-testid="complex-shared-weight"
              >
                {Math.round(sharedWeightValue!)}
              </div>
              <div className="text-lg text-muted-foreground">
                {getWeightUnitLabel(sharedWeightUnit)}
              </div>
              {hasWeightTwo && (
                <>
                  <div className="text-lg text-muted-foreground">+</div>
                  <div
                    className="text-3xl font-medium"
                    data-testid="complex-shared-weight-two"
                  >
                    {Math.round(sharedWeightTwoValue!)}
                  </div>
                  <div className="text-lg text-muted-foreground">
                    {getWeightUnitLabel(sharedWeightTwoUnit)}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {totalSides > 1 && (
          <CardDescription
            className="pb-1 text-center"
            data-testid="current-side"
          >
            {activeHand} hand · side {currentSide} of {totalSides}
          </CardDescription>
        )}

        <div className="divide-y">
          {movements.map((movement, index) => {
            const repIndex = Math.min(rungIndex, movement.repScheme.length - 1);
            return (
              <div
                key={index}
                className="flex items-center justify-between py-1"
              >
                <div
                  className="min-w-0 flex-1 truncate pr-2 font-medium"
                  data-testid={`complex-movement-name-${index}`}
                >
                  {movement.movementName}
                </div>
                <div
                  className="shrink-0 text-2xl font-medium"
                  data-testid={`complex-movement-reps-${index}`}
                >
                  {movement.maxReps
                    ? 'Max'
                    : movement.timedRungs
                      ? formatRungDuration(movement.repScheme[repIndex])
                      : movement.repScheme[repIndex]}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
