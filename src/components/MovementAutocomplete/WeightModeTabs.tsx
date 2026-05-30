import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { cn } from '~/lib/utils';
import { WeightTabValue } from '~/types';
import { WEIGHT_MODE_LABELS } from '~/utils';

interface WeightModeTabsProps {
  value: WeightTabValue;
  onValueChange: (value: WeightTabValue) => void;
  className?: string;
}

export const WeightModeTabs = ({
  value,
  onValueChange,
  className,
}: WeightModeTabsProps) => (
  <Tabs
    value={value}
    onValueChange={(next) => onValueChange(next as WeightTabValue)}
    className={cn('w-full', className)}
  >
    <TabsList className="flex w-full">
      <TabsTrigger className="flex-1" size="sm" value="none">
        {WEIGHT_MODE_LABELS.none}
      </TabsTrigger>
      <TabsTrigger className="flex-1" size="sm" value="2h">
        {WEIGHT_MODE_LABELS['2h']}
      </TabsTrigger>
      <TabsTrigger className="flex-1" size="sm" value="1h">
        {WEIGHT_MODE_LABELS['1h']}
      </TabsTrigger>
      <TabsTrigger className="flex-1" size="sm" value="double">
        {WEIGHT_MODE_LABELS.double}
      </TabsTrigger>
    </TabsList>
  </Tabs>
);
