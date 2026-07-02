import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { MovementOptions, WeightUnit } from '~/types';
import { getWeightUnitLabel } from '~/utils';

interface ComplexMovementDisplayProps {
  currentRound: number;
  movements: MovementOptions[];
  rungIndex: number;
  sharedWeightTwoUnit: WeightUnit | null;
  sharedWeightTwoValue: number | null;
  sharedWeightUnit: WeightUnit | null;
  sharedWeightValue: number | null;
}

export const ComplexMovementDisplay = ({
  currentRound,
  movements,
  rungIndex,
  sharedWeightTwoUnit,
  sharedWeightTwoValue,
  sharedWeightUnit,
  sharedWeightValue,
}: ComplexMovementDisplayProps) => {
  const hasWeightOne = sharedWeightValue !== null && sharedWeightValue > 0;
  const hasWeightTwo =
    sharedWeightTwoValue !== null && sharedWeightTwoValue > 0;

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
                  {movement.repScheme[repIndex]}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
