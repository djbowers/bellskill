import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { WeightUnit } from '~/types';

interface WeightUnitTabsProps {
  value: WeightUnit | null;
  onChange: (value: WeightUnit) => void;
}

export const WeightUnitTabs = ({ value, onChange }: WeightUnitTabsProps) => {
  if (!value) return null;

  const handleChange = (value: string) => onChange(value as WeightUnit);

  return (
    <Tabs value={value} onValueChange={handleChange}>
      <TabsList>
        <TabsTrigger size="sm" value="kilograms">
          kg
        </TabsTrigger>
        <TabsTrigger size="sm" value="pounds">
          lb
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
};
