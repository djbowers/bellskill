import { XMarkIcon } from '@heroicons/react/24/outline';

import { useUnlinkMovementLog } from '~/api';
import { Badge } from '~/components/ui/badge';

export interface CatalogedBadgeProps {
  movementLogId: number;
  workoutLogId: number;
}

export const CatalogedBadge = ({
  movementLogId,
  workoutLogId,
}: CatalogedBadgeProps) => {
  const { mutate: unlinkMovementLog, isLoading } =
    useUnlinkMovementLog(workoutLogId);

  return (
    <Badge
      variant="secondary"
      className="inline-flex items-center gap-0.5 pr-0.5 text-xs"
    >
      Cataloged
      <button
        type="button"
        aria-label="Unlink from catalog"
        className="inline-flex shrink-0 items-center justify-center rounded-full p-0.5 hover:bg-secondary-foreground/10 disabled:opacity-50"
        disabled={isLoading}
        onClick={() => unlinkMovementLog({ movementLogId })}
      >
        <XMarkIcon className="h-1.5 w-1.5" />
      </button>
    </Badge>
  );
};
