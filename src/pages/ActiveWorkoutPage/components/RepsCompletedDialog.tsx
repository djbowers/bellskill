import { useState } from 'react';

import { ModifyCountButtons } from '~/components';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';

const REPS_RANGE = { min: 0, max: 100, step: 1 };

export interface RepsPromptMovement {
  movementIndex: number;
  movementName: string;
  /** Seed for the caliper: the prescribed rung, or the last max-reps answer. */
  defaultReps: number;
}

interface RepsCompletedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The movements in the set being completed — one caliper each. */
  movements: RepsPromptMovement[];
  /** True when the set can't be completed without an answer (max reps). */
  required: boolean;
  onConfirm: (repsByMovementIndex: Record<number, number>) => void;
}

/**
 * Reports what was actually lifted. Reached two ways: required, when a set is
 * taken to failure and has no prescription to assume; or optional, from the
 * Adjust reps button, when you got 3 of the 5 you were asked for. Either way
 * confirming completes the set exactly as a Continue press does.
 */
export const RepsCompletedDialog = ({
  open,
  onOpenChange,
  movements,
  required,
  onConfirm,
}: RepsCompletedDialogProps) => {
  const [reps, setReps] = useState<Record<number, number>>({});

  const repsFor = (movement: RepsPromptMovement) =>
    reps[movement.movementIndex] ?? movement.defaultReps;

  const clamp = (value: number) =>
    Math.min(REPS_RANGE.max, Math.max(REPS_RANGE.min, value));

  const setRepsFor = (movement: RepsPromptMovement, value: number) =>
    setReps((current) => ({
      ...current,
      [movement.movementIndex]: clamp(value),
    }));

  // Functional so a burst of taps composes off the pending value rather than
  // the one this render closed over.
  const stepRepsFor = (movement: RepsPromptMovement, delta: number) =>
    setReps((current) => ({
      ...current,
      [movement.movementIndex]: clamp(
        (current[movement.movementIndex] ?? movement.defaultReps) + delta,
      ),
    }));

  const handleConfirm = () => {
    onConfirm(
      Object.fromEntries(
        movements.map((movement) => [movement.movementIndex, repsFor(movement)]),
      ),
    );
    setReps({});
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setReps({});
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>How many reps?</DialogTitle>
          <DialogDescription>
            {required
              ? 'This set runs to failure — log what you hit.'
              : 'Log what you actually completed for this set.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-w-0 flex-col gap-2">
          {movements.map((movement) => (
            <div
              key={movement.movementIndex}
              className="flex flex-col gap-1 border-t border-border pt-2 first:border-t-0 first:pt-0"
            >
              {movements.length > 1 && (
                <h2 className="text-sm font-semibold">
                  {movement.movementName}
                </h2>
              )}
              <ModifyCountButtons
                {...REPS_RANGE}
                label={movement.movementName}
                unit="reps"
                value={repsFor(movement)}
                onChange={(value) => setRepsFor(movement, value)}
                onClickMinus={() => stepRepsFor(movement, -REPS_RANGE.step)}
                onClickPlus={() => stepRepsFor(movement, REPS_RANGE.step)}
              />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Complete set</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
