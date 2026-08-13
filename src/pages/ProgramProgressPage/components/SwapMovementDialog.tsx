import { useMemo, useState } from 'react';

import { useSwapProgramMovement } from '~/api';
import { MovementAutocomplete } from '~/components/MovementAutocomplete';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { useToast } from '~/contexts';
import { WeightTabValue, WeightUnit } from '~/types';
import { WEIGHT_MODE_LABELS } from '~/utils';

import {
  WeightSlots,
} from '~/pages/ProgramDetailsPage/ProgramDetailsPage';
import { MovementWeightControl } from '~/pages/ProgramDetailsPage/utils/deriveMovementWeights';
import { StartingWeight } from '~/pages/ProgramDetailsPage/utils/deriveWeightGroups';

const DEFAULT_WEIGHT_VALUE = 24;
const DEFAULT_WEIGHT_UNIT: WeightUnit = 'kilograms';

/** The replacement's full weight config plus the rename itself — everything the
 *  swap RPC needs beyond the enrollment id. */
export interface MovementSwap {
  oldMovementName: string;
  newMovementName: string;
  weightOneValue: number | null;
  weightOneUnit: WeightUnit | null;
  weightTwoValue: number | null;
  weightTwoUnit: WeightUnit | null;
}

/** Re-encode the carried-over weight into the chosen mode's null-pattern
 *  ('2h' = two null, '1h' = two 0, 'double' = both loaded, 'none' = all null). */
const adaptWeightToMode = (
  weight: StartingWeight,
  mode: WeightTabValue,
): StartingWeight => {
  if (mode === 'none') {
    return {
      sharedWeightOneValue: null,
      sharedWeightOneUnit: null,
      sharedWeightTwoValue: null,
      sharedWeightTwoUnit: null,
    };
  }
  const unit = weight.sharedWeightOneUnit ?? DEFAULT_WEIGHT_UNIT;
  const one = weight.sharedWeightOneValue ?? DEFAULT_WEIGHT_VALUE;
  if (mode === '2h') {
    return {
      sharedWeightOneValue: one,
      sharedWeightOneUnit: unit,
      sharedWeightTwoValue: null,
      sharedWeightTwoUnit: null,
    };
  }
  if (mode === '1h') {
    return {
      sharedWeightOneValue: one,
      sharedWeightOneUnit: unit,
      sharedWeightTwoValue: 0,
      sharedWeightTwoUnit: unit,
    };
  }
  const two = weight.sharedWeightTwoValue;
  return {
    sharedWeightOneValue: one,
    sharedWeightOneUnit: unit,
    sharedWeightTwoValue: two !== null && two > 0 ? two : one,
    sharedWeightTwoUnit: unit,
  };
};

interface SwapMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The program's distinct movements with their current modal weights. */
  movements: MovementWeightControl[];
  /**
   * Live mode: the active enrollment to rewrite immediately via the swap RPC.
   * Omit when using `onPendingSwap`.
   */
  userProgramId?: string;
  /**
   * Pending mode (pre-enrollment): confirm hands the swap to the caller
   * instead of mutating — the page applies it after `enroll_in_program`.
   */
  onPendingSwap?: (swap: MovementSwap) => void;
  /** Lock the dialog to one movement (per-movement launch); hides the picker. */
  oldMovementName?: string;
  /** Names claimed outside `movements` (e.g. other pending swaps). */
  extraTakenNames?: string[];
}

/**
 * Replace one of a program's movements with another: pick the outgoing
 * movement, search the catalog for its replacement, and carry the weight
 * config over (re-shaped when the loading mode changes). Rep schemes are
 * untouched — only the name and weights move.
 */
export const SwapMovementDialog = ({
  open,
  onOpenChange,
  movements,
  userProgramId,
  onPendingSwap,
  oldMovementName,
  extraTakenNames = [],
}: SwapMovementDialogProps) => {
  const swap = useSwapProgramMovement();
  const { showToast } = useToast();

  const [selectedOldName, setSelectedOldName] = useState(
    oldMovementName ?? movements[0]?.movementName ?? '',
  );
  const oldControl = movements.find(
    (control) => control.movementName === selectedOldName,
  );

  const [newName, setNewName] = useState('');
  // null until touched — seeded from whichever old movement is selected.
  const [mode, setMode] = useState<WeightTabValue | null>(null);
  // The catalog settles how the replacement is held, so picking one locks the
  // mode; a name we have no catalog row for stays hand-picked.
  const [pickedWeightMode, setPickedWeightMode] =
    useState<WeightTabValue | null>(null);
  const [weight, setWeight] = useState<StartingWeight | null>(null);

  const effectiveMode = mode ?? oldControl?.mode ?? '2h';
  const effectiveWeight =
    weight ??
    adaptWeightToMode(
      oldControl?.modalWeight ?? {
        sharedWeightOneValue: null,
        sharedWeightOneUnit: null,
        sharedWeightTwoValue: null,
        sharedWeightTwoUnit: null,
      },
      effectiveMode,
    );

  const handleSelectOldName = (name: string) => {
    setSelectedOldName(name);
    setMode(null);
    setWeight(null);
    setPickedWeightMode(null);
  };

  const handleModeChange = (nextMode: WeightTabValue) => {
    setMode(nextMode);
    setWeight(adaptWeightToMode(effectiveWeight, nextMode));
  };

  const handleMovementPick = (
    _name: string,
    _functionalMovementId?: string | null,
    weightMode?: WeightTabValue | null,
  ) => {
    setPickedWeightMode(weightMode ?? null);
    if (weightMode) handleModeChange(weightMode);
  };

  const handleChangeNewName = (name: string) => {
    setNewName(name);
    setPickedWeightMode(null);
  };

  const takenNames = useMemo(
    () =>
      new Set(
        [...movements.map((control) => control.movementName), ...extraTakenNames]
          .map((name) => name.toLowerCase()),
      ),
    [movements, extraTakenNames],
  );
  const trimmedNewName = newName.trim();
  const isDuplicate = takenNames.has(trimmedNewName.toLowerCase());
  const canConfirm = trimmedNewName.length > 0 && !isDuplicate && !swap.isPending;

  const handleConfirm = () => {
    const payload: MovementSwap = {
      oldMovementName: selectedOldName,
      newMovementName: trimmedNewName,
      weightOneValue: effectiveWeight.sharedWeightOneValue,
      weightOneUnit: effectiveWeight.sharedWeightOneUnit,
      weightTwoValue: effectiveWeight.sharedWeightTwoValue,
      weightTwoUnit: effectiveWeight.sharedWeightTwoUnit,
    };

    if (onPendingSwap) {
      onPendingSwap(payload);
      onOpenChange(false);
      return;
    }

    if (!userProgramId) return;
    swap.mutate(
      { userProgramId, ...payload },
      {
        onSuccess: (updatedCount) => {
          showToast(
            `Movement swapped in ${updatedCount} upcoming session${updatedCount === 1 ? '' : 's'}`,
          );
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Swap movement</DialogTitle>
          <DialogDescription>
            Replaces this movement on every session you haven&apos;t done yet.
            Rep schemes stay the same; completed workouts aren&apos;t changed.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-w-0 flex-col gap-2">
          {oldMovementName ? (
            <p className="text-sm font-semibold">{oldMovementName}</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-muted-foreground">
                Movement to replace
              </span>
              <Select value={selectedOldName} onValueChange={handleSelectOldName}>
                <SelectTrigger aria-label="Movement to replace">
                  <SelectValue placeholder="Pick a movement" />
                </SelectTrigger>
                <SelectContent>
                  {movements.map((control) => (
                    <SelectItem
                      key={control.movementName}
                      value={control.movementName}
                    >
                      {control.movementName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-muted-foreground">
              Replace with
            </span>
            <MovementAutocomplete
              value={newName}
              onChange={handleChangeNewName}
              weightMode={effectiveMode}
              onWeightModeChange={handleModeChange}
              weightModeLocked={pickedWeightMode !== null}
              deferUserMovementWrite
              onMovementPick={handleMovementPick}
            />
            {isDuplicate && (
              <p className="text-xs text-destructive">
                {trimmedNewName} is already in this program — pick a different
                movement.
              </p>
            )}
          </div>

          {effectiveMode === 'none' ? (
            <p className="text-sm text-muted-foreground">
              {WEIGHT_MODE_LABELS.none}
            </p>
          ) : (
            <WeightSlots
              weight={effectiveWeight}
              onChange={setWeight}
              namePrefix="Working weight"
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            Swap movement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
