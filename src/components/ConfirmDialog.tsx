import { ReactNode } from 'react';

import { Button, ButtonProps } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  confirmVariant?: ButtonProps['variant'];
  dismissLabel: string;
  onConfirm: () => void;
  onDismiss: () => void;
  isPending?: boolean;
}

/**
 * A one-decision confirm. Actions stack one per line and the escape hatch is
 * always the last line — the most thumb-reachable spot on a phone belongs to
 * the choice that changes nothing.
 */
export const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmVariant = 'default',
  dismissLabel,
  onConfirm,
  onDismiss,
  isPending = false,
}: ConfirmDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogFooter className="flex-col gap-1 sm:flex-col sm:gap-1">
        <Button
          variant={confirmVariant}
          className="w-full"
          onClick={onConfirm}
          disabled={isPending}
        >
          {confirmLabel}
        </Button>
        <Button variant="secondary" className="w-full" onClick={onDismiss}>
          {dismissLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
