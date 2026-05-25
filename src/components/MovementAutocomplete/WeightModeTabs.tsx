import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { cn } from '~/lib/utils';
import { WeightTabValue } from '~/types';

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
        None
      </TabsTrigger>
      <TabsTrigger className="flex-1" size="sm" value="2h">
        2H
      </TabsTrigger>
      <TabsTrigger className="flex-1" size="sm" value="1h">
        1H
      </TabsTrigger>
      <TabsTrigger className="flex-1" size="sm" value="double">
        Double
      </TabsTrigger>
    </TabsList>
  </Tabs>
);
