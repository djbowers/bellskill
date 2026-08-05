import {
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { getWeightsDisplayValue } from '~/pages/CompletedWorkoutPage/utils/displayValues';
import {
  MovementOptions,
  WeightTabValue,
  WeightUnit,
} from '~/types';
import {
  SharedWeightOptions,
  WEIGHT_MODE_LABELS,
  getWeightRange,
  getWeightTabValue,
  getWeightUnitLabel,
  resolveMovementWeights,
} from '~/utils';

import { FieldLabel } from './FieldLabel';
import { LadderRepScheme } from './LadderRepScheme';
import { ModifyCountButtons } from './ModifyCountButtons';
import { MovementAutocomplete } from './MovementAutocomplete';
import { MovementSummaryChips } from './MovementSummaryChips';
import { WeightModeTabs } from './WeightModeTabs';
import { WeightUnitTabs } from './WeightUnitTabs';

export interface MovementCardProps {
  index: number;
  movement: MovementOptions;
  /** The workout runs off one bell, so the card reflects the shared weight. */
  sharedBell: boolean;
  sharedWeightTabValue: WeightTabValue;
  /** The shared weight, displayed in place of the movement's own. */
  sharedWeights: Omit<SharedWeightOptions, 'workoutMode' | 'sharedBell'>;
  expanded: boolean;
  /** The interval timer is on, so timed rungs must be disabled. */
  intervalActive: boolean;
  onToggleExpanded: () => void;
  onRemove: () => void;
  onChangeName: (name: string) => void;
  onChangeWeightTab: (mode: WeightTabValue) => void;
  onChangeWeightOneValue: (value: number) => void;
  onChangeWeightOneUnit: (unit: WeightUnit) => void;
  onChangeWeightTwoValue: (value: number) => void;
  onChangeWeightTwoUnit: (unit: WeightUnit) => void;
  onChangeRung: (rungIndex: number, value: number) => void;
  onRemoveRung: (rungIndex: number) => void;
  onAddRung: () => void;
  onToggleTimed: (timed: boolean) => void;
}

export const MovementCard = ({
  index,
  movement,
  sharedBell,
  sharedWeightTabValue,
  sharedWeights,
  expanded,
  intervalActive,
  onToggleExpanded,
  onRemove,
  onChangeName,
  onChangeWeightTab,
  onChangeWeightOneValue,
  onChangeWeightOneUnit,
  onChangeWeightTwoValue,
  onChangeWeightTwoUnit,
  onChangeRung,
  onRemoveRung,
  onAddRung,
  onToggleTimed,
}: MovementCardProps) => {
  const weightTabValue = getWeightTabValue(movement);
  const activeWeightMode = sharedBell ? sharedWeightTabValue : weightTabValue;
  const named = movement.movementName.length > 0;
  const displayedMovement = resolveMovementWeights(movement, {
    sharedBell,
    ...sharedWeights,
  });
  const weightSummary = named
    ? getWeightsDisplayValue(
        displayedMovement.weightOneValue,
        displayedMovement.weightOneUnit,
        displayedMovement.weightTwoValue,
        displayedMovement.weightTwoUnit,
      )
    : null;
  const showLoad = !sharedBell && weightTabValue !== 'none';

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-1 p-1.5">
        <div
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground shadow"
          aria-hidden
        >
          {index + 1}
        </div>

        <div className="min-w-0 flex-1">
          {expanded ? (
            <MovementAutocomplete
              value={movement.movementName}
              onChange={onChangeName}
              weightMode={activeWeightMode}
              onWeightModeChange={onChangeWeightTab}
              showWeightModeTabs={false}
              weightModeHint={
                sharedBell
                  ? `Using shared weight: ${WEIGHT_MODE_LABELS[sharedWeightTabValue]}`
                  : null
              }
              weightSummary={weightSummary}
            />
          ) : (
            <button
              type="button"
              onClick={onToggleExpanded}
              className="w-full text-left"
              aria-expanded={false}
              aria-label={`Expand ${named ? movement.movementName : `movement ${index + 1}`}`}
            >
              <div className="truncate text-sm font-semibold leading-tight">
                {named ? (
                  movement.movementName
                ) : (
                  <span className="text-muted-foreground">Untitled movement</span>
                )}
              </div>
              <div className="mt-0.5">
                <MovementSummaryChips
                  movement={displayedMovement}
                  weightMode={activeWeightMode}
                />
              </div>
            </button>
          )}
        </div>

        <div className="flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon"
            aria-label={expanded ? 'Collapse movement' : 'Expand movement'}
            aria-expanded={expanded}
            onClick={onToggleExpanded}
          >
            {expanded ? (
              <ChevronUpIcon className="h-2.5 w-2.5" />
            ) : (
              <ChevronDownIcon className="h-2.5 w-2.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Remove movement"
            onClick={onRemove}
          >
            <XMarkIcon className="h-2.5 w-2.5" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="flex flex-col gap-1.5 px-1.5 pb-1.5">
          <div className="h-px bg-border" />

          {!sharedBell && (
            <div>
              <FieldLabel className="mb-0.5">Weight</FieldLabel>
              <WeightModeTabs
                value={activeWeightMode}
                onValueChange={onChangeWeightTab}
              />
            </div>
          )}

          {showLoad && (
            <div>
              <FieldLabel className="mb-0.5">Load</FieldLabel>
              <ModifyCountButtons
                {...getWeightRange(movement.weightOneUnit)}
                bellUnit={movement.weightOneUnit}
                onClickMinus={() =>
                  onChangeWeightOneValue(movement.weightOneValue! - 1)
                }
                onClickPlus={() =>
                  onChangeWeightOneValue(movement.weightOneValue! + 1)
                }
                unit={getWeightUnitLabel(movement.weightOneUnit)}
                unitTabs={
                  <WeightUnitTabs
                    value={movement.weightOneUnit}
                    onChange={onChangeWeightOneUnit}
                  />
                }
                value={movement.weightOneValue!}
                onChange={onChangeWeightOneValue}
              />
              {movement.weightTwoValue !== null &&
                movement.weightTwoValue > 0 && (
                  <div className="mt-1.5">
                    <ModifyCountButtons
                      {...getWeightRange(movement.weightTwoUnit)}
                      bellUnit={movement.weightTwoUnit}
                      onClickMinus={() =>
                        onChangeWeightTwoValue(movement.weightTwoValue! - 1)
                      }
                      onClickPlus={() =>
                        onChangeWeightTwoValue(movement.weightTwoValue! + 1)
                      }
                      unit={getWeightUnitLabel(movement.weightTwoUnit)}
                      unitTabs={
                        <WeightUnitTabs
                          value={movement.weightTwoUnit}
                          onChange={onChangeWeightTwoUnit}
                        />
                      }
                      value={movement.weightTwoValue}
                      onChange={onChangeWeightTwoValue}
                    />
                  </div>
                )}
            </div>
          )}

          <LadderRepScheme
            repScheme={movement.repScheme}
            timedRungs={movement.timedRungs}
            intervalActive={intervalActive}
            onChangeRung={onChangeRung}
            onRemoveRung={onRemoveRung}
            onAddRung={onAddRung}
            onToggleTimed={onToggleTimed}
          />
        </div>
      )}
    </Card>
  );
};
