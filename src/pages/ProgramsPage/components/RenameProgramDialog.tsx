import { useState } from 'react';

import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';

export interface RenameProgramDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTitle: string;
  onSubmit: (title: string) => void;
  isPending: boolean;
}

const RenameProgramForm = ({
  currentTitle,
  onOpenChange,
  onSubmit,
  isPending,
}: Omit<RenameProgramDialogProps, 'open'>) => {
  const [title, setTitle] = useState(currentTitle);
  const trimmed = title.trim();

  return (
    <>
      <DialogHeader>
        <DialogTitle>Rename program</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-0.5">
        <Label htmlFor="rename-program-title">Title</Label>
        <Input
          id="rename-program-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Dry Fighting Weight"
        />
      </div>

      <DialogFooter>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          onClick={() => onSubmit(trimmed)}
          disabled={
            trimmed.length === 0 || trimmed === currentTitle.trim() || isPending
          }
        >
          {isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogFooter>
    </>
  );
};

/**
 * Renames an owned program. The form is remounted on each open (`open &&`) so
 * the input re-seeds from the current title instead of keeping a stale draft.
 */
export const RenameProgramDialog = ({
  open,
  ...props
}: RenameProgramDialogProps) => (
  <Dialog open={open} onOpenChange={props.onOpenChange}>
    <DialogContent>{open && <RenameProgramForm {...props} />}</DialogContent>
  </Dialog>
);
