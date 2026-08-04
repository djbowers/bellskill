import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

import type { UserEquipment } from '~/api';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { getBellColor } from '~/utils';

import {
  equipmentBadges,
  equipmentName,
  equipmentWeightLabel,
} from '../utils/equipmentDisplay';

interface EquipmentListRowProps {
  item: UserEquipment;
  onEdit: (item: UserEquipment) => void;
  onDelete: (item: UserEquipment) => void;
}

export const EquipmentListRow = ({
  item,
  onEdit,
  onDelete,
}: EquipmentListRowProps) => {
  const name = equipmentName(item);
  const chipColor =
    item.kind === 'fixed' ? getBellColor(item.weight!, item.unit) : null;

  return (
    <Card>
      <CardContent className="flex min-w-0 items-center gap-1 py-1.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          <span
            className="h-1.5 w-1.5 flex-none rounded border border-border"
            style={
              chipColor
                ? { backgroundColor: chipColor }
                : {
                    backgroundImage:
                      'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--destructive)))',
                  }
            }
            aria-hidden="true"
          />

          <span className="font-medium">{equipmentWeightLabel(item)}</span>

          {equipmentBadges(item).map((badge) => (
            <Badge key={badge} variant="secondary" className="whitespace-nowrap">
              {badge}
            </Badge>
          ))}
        </div>

        <div className="flex flex-none gap-0.5">
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Edit ${name}`}
            onClick={() => onEdit(item)}
          >
            <PencilIcon className="h-2 w-2" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Remove ${name}`}
            onClick={() => onDelete(item)}
          >
            <TrashIcon className="h-2 w-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
