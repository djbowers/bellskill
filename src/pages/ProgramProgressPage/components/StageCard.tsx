import { useState } from 'react';

import { useSetProgramStage } from '~/api';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Card, CardContent } from '~/components/ui/card';
import { useToast } from '~/contexts';
import { ProgramStage } from '~/types';

interface StageCardProps {
  /** The active enrollment being moved along the ladder. */
  userProgramId: string;
  /** The program's full stage ladder, in order. */
  stages: ProgramStage[];
  /** The enrollment's current 0-based position on the ladder. */
  currentStageIndex: number;
  /** Whether the enrollment is active (stage moves are disabled otherwise). */
  canAdvance: boolean;
}

/**
 * The enrollment's position on its program's progression ladder, with
 * confirm-gated Advance / Go back actions. Advancing rewrites every
 * not-yet-completed session to the target stage's movements, title, and notes;
 * weights are untouched (that's the Adjust weights flow).
 */
export const StageCard = ({
  userProgramId,
  stages,
  currentStageIndex,
  canAdvance,
}: StageCardProps) => {
  const setStage = useSetProgramStage();
  const { showToast } = useToast();
  const [targetIndex, setTargetIndex] = useState<number | null>(null);

  const current = stages[currentStageIndex];
  if (!current) return null;

  const target = targetIndex === null ? null : stages[targetIndex];
  const isLast = currentStageIndex >= stages.length - 1;
  const isFirst = currentStageIndex <= 0;

  const handleConfirm = () => {
    if (targetIndex === null) return;
    setStage.mutate(
      { userProgramId, stageIndex: targetIndex },
      {
        onSuccess: (updatedCount) => {
          showToast(
            `Moved to ${stages[targetIndex].title} — ${updatedCount} upcoming session${updatedCount === 1 ? '' : 's'} updated`,
          );
          setTargetIndex(null);
        },
      },
    );
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-1 pt-2">
        <div className="flex items-baseline justify-between text-sm font-medium">
          <span>
            Stage {currentStageIndex + 1} of {stages.length}: {current.title}
          </span>
        </div>
        {canAdvance && (
          <div className="flex items-center gap-2">
            {!isLast && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setTargetIndex(currentStageIndex + 1)}
              >
                Advance stage
              </Button>
            )}
            {!isFirst && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setTargetIndex(currentStageIndex - 1)}
              >
                Go back
              </Button>
            )}
          </div>
        )}
      </CardContent>

      {target && (
        <Dialog
          open={targetIndex !== null}
          onOpenChange={(open) => !open && setTargetIndex(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Move to {target.title}?</DialogTitle>
              <DialogDescription>
                Rewrites every session you haven&apos;t done yet to the{' '}
                {target.title} complex. Weights aren&apos;t changed, and
                completed workouts stay as they were.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setTargetIndex(null)}>
                Cancel
              </Button>
              <Button onClick={handleConfirm} disabled={setStage.isPending}>
                Move to {target.title}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
};
