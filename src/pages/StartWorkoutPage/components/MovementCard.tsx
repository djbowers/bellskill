import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { cn } from '~/lib/utils';
import { MovementOptions, WeightTabValue, WeightUnit } from '~/types';
import {
  SharedWeightOptions,
  WEIGHT_MODE_LABELS,
  getWeightRange,
  getWeightTabValue,
  getWeightUnitLabel,
  resolveMovementWeights,
} from '~/utils';

import { loadSummary } from '../utils/loadSummary';
import { FieldLabel } from './FieldLabel';
import { LadderRepScheme } from './LadderRepScheme';
import { LegModeIndicator } from './LegModeIndicator';
import { LegModeTabs } from './LegModeTabs';
import { ModifyCountButtons } from './ModifyCountButtons';
import {
  MovementAutocomplete,
  type MovementAutocompleteProps,
} from './MovementAutocomplete';
import { MovementSummaryChips } from './MovementSummaryChips';
import { WeightModeIndicator } from './WeightModeIndicator';
import { WeightModeTabs } from './WeightModeTabs';
import { WeightUnitTabs } from './WeightUnitTabs';

export interface MovementCardProps {
  /** Stable sortable identity — builder-local, never persisted. */
  id: string;
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
  /** This movement is the subject of a blocking issue listed above Start. */
  hasError?: boolean;
  /** Straight sets reads the rep scheme as a list of sets, not a ladder. */
  repSchemeUnitNoun?: 'rung' | 'set';
  /** The mode the catalog dictates for this movement; null when it has no row. */
  catalogWeightMode?: WeightTabValue | null;
  /** The catalog settled this movement's laterality; null when it has no row. */
  catalogUnilateral?: boolean | null;
  onToggleExpanded: () => void;
  onRemove: () => void;
  onChangeName: MovementAutocompleteProps['onChange'];
  onChangeWeightTab: (mode: WeightTabValue) => void;
  onChangeWeightOneValue: (value: number) => void;
  onChangeWeightOneUnit: (unit: WeightUnit) => void;
  onChangeWeightTwoValue: (value: number) => void;
  onChangeWeightTwoUnit: (unit: WeightUnit) => void;
  onChangeRung: (rungIndex: number, value: number) => void;
  onRemoveRung: (rungIndex: number) => void;
  onAddRung: () => void;
  onToggleTimed: (timed: boolean) => void;
  onToggleUnilateral: (unilateral: boolean) => void;
}

export const MovementCard = ({
  id,
  index,
  movement,
  sharedBell,
  sharedWeightTabValue,
  sharedWeights,
  expanded,
  intervalActive,
  hasError = false,
  repSchemeUnitNoun = 'rung',
  catalogWeightMode = null,
  catalogUnilateral = null,
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
  onToggleUnilateral,
}: MovementCardProps) => {
  const weightTabValue = getWeightTabValue(movement);
  const activeWeightMode = sharedBell ? sharedWeightTabValue : weightTabValue;
  const named = movement.movementName.length > 0;
  const displayedMovement = resolveMovementWeights(movement, {
    sharedBell,
    ...sharedWeights,
  });
  const showLoad = !sharedBell && weightTabValue !== 'none';

  // The mode is a fact, not a choice, when the catalog settled it or the shared
  // bell overrode it — either way there is nothing here to pick.
  const weightModeReadOnly = sharedBell || catalogWeightMode !== null;
  // Same rule as the weight mode: a cataloged movement's laterality is a fact,
  // not a setting. Unlike weight it has nothing to say when it is bilateral,
  // so the whole row drops out rather than reading "Both legs" on every card.
  const legModeReadOnly = catalogUnilateral !== null;

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  // Expanded, the Weight and Load rows below already state the mode and the
  // load, so a summary line would only repeat them. Under a shared bell both
  // rows are gone, so this is the one place the movement's load appears — and
  // the mode indicator carries the mode, leaving the deviation to name itself.
  const sharedWeightHint = sharedBell
    ? [
        'Shared bell',
        named ? loadSummary(displayedMovement) : null,
        catalogWeightMode && catalogWeightMode !== sharedWeightTabValue
          ? `usually ${WEIGHT_MODE_LABELS[catalogWeightMode]}`
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : null;

  return (
    <Card
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'overflow-hidden',
        hasError && 'border-destructive',
        isDragging && 'relative z-10 opacity-70 shadow-lg',
      )}
      aria-invalid={hasError || undefined}
    >
      <div className="flex items-start gap-1 p-1.5">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Reorder movement ${index + 1}`}
          className="flex h-4 w-4 shrink-0 cursor-grab touch-none items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground shadow active:cursor-grabbing"
        >
          {index + 1}
        </button>

        <div className="min-w-0 flex-1">
          {expanded ? (
            <MovementAutocomplete
              value={movement.movementName}
              onChange={onChangeName}
              weightMode={activeWeightMode}
              onWeightModeChange={onChangeWeightTab}
              showWeightModeTabs={false}
              weightModeHint={sharedWeightHint}
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
                  <span className="text-muted-foreground">
                    Untitled movement
                  </span>
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

          {weightModeReadOnly ? (
            <div className="flex items-center gap-1">
              <FieldLabel>Weight</FieldLabel>
              <WeightModeIndicator mode={activeWeightMode} />
            </div>
          ) : (
            <div>
              <FieldLabel className="mb-0.5">Weight</FieldLabel>
              <WeightModeTabs
                value={activeWeightMode}
                onValueChange={onChangeWeightTab}
              />
            </div>
          )}

          {legModeReadOnly ? (
            movement.unilateral && (
              <div className="flex items-center gap-1">
                <FieldLabel>Legs</FieldLabel>
                <LegModeIndicator />
              </div>
            )
          ) : (
            <div>
              <FieldLabel className="mb-0.5">Legs</FieldLabel>
              <LegModeTabs
                unilateral={Boolean(movement.unilateral)}
                onValueChange={onToggleUnilateral}
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
            unitNoun={repSchemeUnitNoun}
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
