import { type ActiveProgram, MAX_ACTIVE_PROGRAMS } from '~/api';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { cn } from '~/lib/utils';

export interface ReplaceProgramDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeEnrollments: ActiveProgram[];
  replaceEnrollmentId: string | null;
  onSelectReplace: (enrollmentId: string) => void;
  onCancel: () => void;
  onQueueInstead: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

/**
 * The at-the-cap prompt. The choice is "which program stops", so the list of
 * running programs is the body and the footer stacks one action per line —
 * replace, queue, or back out — instead of crowding three peers onto one row.
 */
export const ReplaceProgramDialog = ({
  open,
  onOpenChange,
  activeEnrollments,
  replaceEnrollmentId,
  onSelectReplace,
  onCancel,
  onQueueInstead,
  onConfirm,
  isPending,
}: ReplaceProgramDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Replace a program?</DialogTitle>
        <DialogDescription>
          You&apos;re already running {MAX_ACTIVE_PROGRAMS} programs — the most
          you can have at once. Pick one to stop so this new one can take its
          place, or queue it to start when one finishes. A replaced
          program&apos;s logged workouts are kept, but its place in the program
          is cleared.
        </DialogDescription>
      </DialogHeader>

      <div
        role="radiogroup"
        aria-label="Program to replace"
        className="flex flex-col gap-0.5"
      >
        {activeEnrollments.map(({ enrollment, program, progress }) => {
          const selected = replaceEnrollmentId === enrollment.id;
          return (
            <label
              key={enrollment.id}
              className={cn(
                'flex cursor-pointer items-center gap-1 rounded-md border p-1 transition-colors',
                selected
                  ? 'border-primary bg-primary/5'
                  : 'border-transparent hover:bg-secondary',
              )}
            >
              <input
                type="radio"
                name="replace-enrollment"
                value={enrollment.id}
                checked={selected}
                onChange={() => onSelectReplace(enrollment.id)}
              />
              <span className="min-w-0 flex-1 truncate text-sm">
                {program.title}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {progress.completed}/{progress.total}
              </span>
            </label>
          );
        })}
      </div>

      <DialogFooter className="flex-col gap-1 sm:flex-col sm:gap-1">
        <Button
          className="w-full"
          onClick={onConfirm}
          disabled={isPending || !replaceEnrollmentId}
        >
          Replace program
        </Button>
        <Button
          variant="secondary"
          className="w-full"
          onClick={onQueueInstead}
          disabled={isPending}
        >
          Queue instead
        </Button>
        <Button
          variant="ghost"
          className="w-full text-muted-foreground"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
