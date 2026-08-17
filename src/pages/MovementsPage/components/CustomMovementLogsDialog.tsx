import { useUserMovementLogs } from '~/api';
import { Loading, MovementLogRow } from '~/components';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';

export interface CustomMovementLogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userMovementId: string | null;
  canonicalName: string;
}

const LogsList = ({ userMovementId }: { userMovementId: string }) => {
  const { data: logs = [], isLoading } = useUserMovementLogs(userMovementId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-3">
        <Loading />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <p className="py-3 text-center text-sm text-muted-foreground">
        No logs are attached to this movement.
      </p>
    );
  }

  return (
    <div className="max-h-[50vh] divide-y overflow-y-auto rounded-md border border-input">
      {logs.map((entry) => (
        <MovementLogRow key={entry.movementLogId} entry={entry} />
      ))}
    </div>
  );
};

/**
 * The sessions a custom movement is attached to. Selecting one navigates to
 * that session, which unmounts the dialog on its way out.
 */
export const CustomMovementLogsDialog = ({
  open,
  onOpenChange,
  userMovementId,
  canonicalName,
}: CustomMovementLogsDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Logs for &ldquo;{canonicalName}&rdquo;</DialogTitle>
        <DialogDescription>
          Every session this movement is logged in.
        </DialogDescription>
      </DialogHeader>

      {open && userMovementId && <LogsList userMovementId={userMovementId} />}
    </DialogContent>
  </Dialog>
);
