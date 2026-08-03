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
    <div className="flex flex-col gap-0.5 p-1">
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
  );
};
