import { useState } from 'react';

import { useLinkMovementLog } from '~/api';
import { MovementAutocomplete } from '~/components/MovementAutocomplete';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import { MovementLog, WeightTabValue } from '~/types';
import { WEIGHT_MODE_LABELS, getWeightTabValue } from '~/utils';

import type { SharedWeights } from '../utils/resolveSharedWeights';

interface PendingMovementPick {
  canonicalName: string;
  functionalMovementId?: string | null;
}

export interface LinkMovementDialogProps {
  workoutLogId: number;
  movementLog: MovementLog;
  movementIndex: number;
  complexSet?: boolean | null;
  sharedWeights: SharedWeights;
}

const getMovementWeightMode = (
  movementLog: MovementLog,
  complexSet: boolean,
  sharedWeights: SharedWeights,
): WeightTabValue => {
  if (complexSet) {
    return getWeightTabValue(sharedWeights);
  }
  return getWeightTabValue(movementLog);
};

export const LinkMovementDialog = ({
  workoutLogId,
  movementLog,
  movementIndex,
  complexSet = false,
  sharedWeights,
}: LinkMovementDialogProps) => {
  const isComplexSet = complexSet === true;
  const weightMode = getMovementWeightMode(
    movementLog,
    isComplexSet,
    sharedWeights,
  );

  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(movementLog.movementName);
  const [pendingPick, setPendingPick] = useState<PendingMovementPick | null>(
    null,
  );

  const { mutate: linkMovementLog, isLoading } =
    useLinkMovementLog(workoutLogId);

  const isLinkedToCatalog = movementLog.functionalMovementId !== null;
  const dialogTitle = isLinkedToCatalog
    ? 'Change movement link'
    : 'Link movement';

  const resetState = () => {
    setInputValue(movementLog.movementName);
    setPendingPick(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetState();
    }
  };

  const handleMovementPick = (
    name: string,
    functionalMovementId?: string | null,
  ) => {
    setPendingPick({ canonicalName: name, functionalMovementId });
  };

  const handleConfirm = () => {
    const pick = pendingPick ?? {
      canonicalName: inputValue,
      functionalMovementId: null,
    };

    linkMovementLog(
      {
        movementLogId: movementLog.id,
        movementIndex,
        canonicalName: pick.canonicalName,
        functionalMovementId: pick.functionalMovementId,
      },
      {
        onSuccess: () => {
          setOpen(false);
          resetState();
        },
      },
    );
  };

  const canConfirm =
    (pendingPick !== null || inputValue.trim().length > 0) && !isLoading;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-auto shrink-0 px-1 py-0">
          Match to catalog
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            Currently: {movementLog.movementName}
            {isLinkedToCatalog && ' (linked to catalog)'}
          </DialogDescription>
        </DialogHeader>

        <MovementAutocomplete
          value={inputValue}
          onChange={setInputValue}
          weightMode={weightMode}
          onWeightModeChange={() => {}}
          showWeightModeTabs={false}
          weightModeHint={`Catalog filtered to ${WEIGHT_MODE_LABELS[weightMode]}`}
          deferUserMovementWrite
          onMovementPick={handleMovementPick}
        />

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
            loading={isLoading}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// eslint-disable-next-line react-refresh/only-export-components -- re-export for tests that may need weight mode helper; kept alongside the component intentionally
export { getMovementWeightMode };
