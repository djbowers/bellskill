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
import { Program } from '~/types';

export interface ResumeProgramDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  program: Program | null;
  /** At the cap, the enrollment either choice displaces — named, never silent. */
  displacedByResume: ActiveProgram | null;
  onResume: () => void;
  onStartOver: () => void;
  isPending: boolean;
}

export const ResumeProgramDialog = ({
  open,
  onOpenChange,
  program,
  displacedByResume,
  onResume,
  onStartOver,
  isPending,
}: ResumeProgramDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Resume this program?</DialogTitle>
        <DialogDescription>
          You already have progress in{program ? ` "${program.title}"` : ''}.
          Pick up where you left off, or start over from the first session.
          {displacedByResume
            ? ` You're at ${MAX_ACTIVE_PROGRAMS} programs, so either way this replaces ${displacedByResume.program.title}.`
            : ''}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter className="flex-col gap-1 sm:flex-col sm:gap-1">
        <Button className="w-full" onClick={onResume} disabled={isPending}>
          Resume
        </Button>
        <Button
          variant="secondary"
          className="w-full"
          onClick={onStartOver}
          disabled={isPending}
        >
          Start over
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
