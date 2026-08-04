import { ChevronRightIcon } from '@heroicons/react/24/outline';

import { Badge } from '~/components/ui/badge';
import { Movement } from '~/types';

interface Props {
  movement: Movement;
}

export const MovementRow = ({ movement }: Props) => {
  const badges = [
    movement.movementPattern1,
    movement.primaryEquipment,
    movement.difficultyLevel,
    movement.targetMuscleGroup,
  ].filter((badge): badge is string => badge !== null);

  return (
    <div className="flex items-center gap-1 p-1 hover:bg-accent hover:text-accent-foreground">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="font-medium">{movement.movementName}</div>
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-0.5">
            {badges.map((badge) => (
              <Badge key={badge} variant="secondary">
                {badge}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <ChevronRightIcon className="h-2 w-2 shrink-0 text-muted-foreground" />
    </div>
  );
};
