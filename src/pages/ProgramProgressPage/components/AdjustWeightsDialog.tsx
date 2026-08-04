import { useMemo, useState } from 'react';

import { useAdjustProgramWeights } from '~/api';
import type { MovementWeight } from '~/api';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { useToast } from '~/contexts';
import { WEIGHT_MODE_LABELS } from '~/utils';

import { WeightSlots } from '~/pages/ProgramDetailsPage/ProgramDetailsPage';
import {
  deriveMovementWeights,
  isComplexProgram,
} from '~/pages/ProgramDetailsPage/utils/deriveMovementWeights';
import {
  deriveStartingWeight,
  StartingWeight,
} from '~/pages/ProgramDetailsPage/utils/deriveWeightGroups';
import {
  selectWeightModalSessions,
  SessionWithState,
} from '~/pages/ProgramDetailsPage/utils/selectWeightModalSessions';

interface AdjustWeightsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The active enrollment the new weights apply to. */
  userProgramId: string;
  /**
   * Clone sessions with progress state. Prefill uses the label-aware working
   * baseline (same rule as `adjust_program_weights`), not every session.
   */
  sessionItems: SessionWithState[];
}

/**
 * Mid-program counterpart to the enrollment starting-weight picker: change the
 * working weight(s) of an active program for every session not yet completed.
 * Pre-fills from the clone's label-aware working baseline so heavier/lighter
 * days keep their offsets when the RPC re-bases.
 */
export const AdjustWeightsDialog = ({
  open,
  onOpenChange,
  userProgramId,
  sessionItems,
}: AdjustWeightsDialogProps) => {
  const adjust = useAdjustProgramWeights();
  const { showToast } = useToast();

  const modalSessions = useMemo(
    () => selectWeightModalSessions(sessionItems),
    [sessionItems],
  );
  // Complex is a program-level property — check the full clone, not just the
  // modal subset (week-4 A+A would otherwise look non-complex if only completed
  // work were somehow empty and we fell through oddly).
  const allSessions = useMemo(
    () => sessionItems.map((item) => item.session),
    [sessionItems],
  );
  const complex = useMemo(
    () => isComplexProgram(allSessions),
    [allSessions],
  );
  const movementControls = useMemo(
    () => deriveMovementWeights(modalSessions),
    [modalSessions],
  );
  const currentShared = useMemo(
    () => deriveStartingWeight(modalSessions),
    [modalSessions],
  );

  // Seeded lazily from the clone's current weights; remounting the content on
  // each open (via `open &&` below) re-seeds after an outside data change.
  const [sharedWeight, setSharedWeight] =
    useState<StartingWeight>(currentShared);
  const [movementWeights, setMovementWeights] = useState<
    Record<string, StartingWeight>
  >({});

  const handleSave = () => {
    const payload: MovementWeight[] = movementControls
      .filter((control) => control.mode !== 'none')
      .map((control) => {
        const chosen =
          movementWeights[control.movementName] ?? control.modalWeight;
        return {
          movementName: control.movementName,
          weightOneValue: chosen.sharedWeightOneValue,
          weightOneUnit: chosen.sharedWeightOneUnit,
          weightTwoValue: chosen.sharedWeightTwoValue,
          weightTwoUnit: chosen.sharedWeightTwoUnit,
        };
      });

    adjust.mutate(
      {
        userProgramId,
        ...(complex
          ? {
              sharedWeightOneValue: sharedWeight.sharedWeightOneValue,
              sharedWeightOneUnit: sharedWeight.sharedWeightOneUnit,
              sharedWeightTwoValue: sharedWeight.sharedWeightTwoValue,
              sharedWeightTwoUnit: sharedWeight.sharedWeightTwoUnit,
            }
          : { movementWeights: payload }),
      },
      {
        onSuccess: (updatedCount) => {
          showToast(
            `Weights updated for ${updatedCount} upcoming session${updatedCount === 1 ? '' : 's'}`,
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
          <DialogTitle>Adjust weights</DialogTitle>
          <DialogDescription>
            Sets the working weight for every session you haven&apos;t done
            yet. Heavier and lighter days keep their offsets; completed
            workouts aren&apos;t changed.
          </DialogDescription>
        </DialogHeader>

        {/* min-w-0: the weight strip's intrinsic width must not stretch the
            dialog's grid column past its max width. */}
        <div className="flex min-w-0 flex-col gap-2">
          {complex ? (
            <WeightSlots
              weight={sharedWeight}
              onChange={setSharedWeight}
              namePrefix="Working weight"
            />
          ) : (
            movementControls.map((control) => (
              <div
                key={control.movementName}
                className="flex flex-col gap-1 border-t border-border pt-2 first:border-t-0 first:pt-0"
              >
                <h2 className="text-sm font-semibold">
                  {control.movementName}
                </h2>
                {control.mode === 'none' ? (
                  <p className="text-sm text-muted-foreground">
                    {WEIGHT_MODE_LABELS.none}
                  </p>
                ) : (
                  <WeightSlots
                    weight={
                      movementWeights[control.movementName] ??
                      control.modalWeight
                    }
                    onChange={(next) =>
                      setMovementWeights((current) => ({
                        ...current,
                        [control.movementName]: next,
                      }))
                    }
                    namePrefix={control.movementName}
                  />
                )}
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={adjust.isPending}>
            Update weights
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
