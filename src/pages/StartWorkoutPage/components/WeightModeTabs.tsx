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
    className={cn(className)}
  >
    <TabsList>
      <TabsTrigger size="sm" value="none">
        None
      </TabsTrigger>
      <TabsTrigger size="sm" value="2h">
        2H
      </TabsTrigger>
      <TabsTrigger size="sm" value="1h">
        1H
      </TabsTrigger>
      <TabsTrigger size="sm" value="double">
        Double
      </TabsTrigger>
    </TabsList>
  </Tabs>
);
