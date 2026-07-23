import { useState } from 'react';

import { WeightUnit } from '~/types';
import { getWeightRange, getWeightUnitLabel } from '~/utils';

import { ModifyCountButtons } from './ModifyCountButtons';
import { WeightUnitTabs } from './WeightUnitTabs';

export default {
  component: ModifyCountButtons,
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

const Weight = ({ initialUnit }: { initialUnit: WeightUnit }) => {
  const [unit, setUnit] = useState<WeightUnit>(initialUnit);
  const [value, setValue] = useState(unit === 'pounds' ? 53 : 24);
  const range = getWeightRange(unit);

  return (
    <div className="w-full max-w-sm bg-card p-2">
      <ModifyCountButtons
        {...range}
        bellUnit={unit}
        value={value}
        onChange={setValue}
        onClickMinus={() => setValue((prev) => Math.max(range.min, prev - 1))}
        onClickPlus={() => setValue((prev) => prev + 1)}
        unit={getWeightUnitLabel(unit)}
        unitTabs={<WeightUnitTabs value={unit} onChange={setUnit} />}
      />
    </div>
  );
};

const Plain = ({
  unit,
  initialValue,
  min,
  max,
  step,
}: {
  initialValue: number;
  max: number;
  min: number;
  step: number;
  unit: string;
}) => {
  const [value, setValue] = useState(initialValue);

  return (
    <div className="w-full max-w-sm bg-card p-2">
      <ModifyCountButtons
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={setValue}
        onClickMinus={() => setValue((prev) => Math.max(min, prev - step))}
        onClickPlus={() => setValue((prev) => Math.min(max, prev + step))}
        unit={unit}
      />
    </div>
  );
};

export const Kilograms = { render: () => <Weight initialUnit="kilograms" /> };

export const Pounds = { render: () => <Weight initialUnit="pounds" /> };

export const Reps = {
  render: () => (
    <Plain unit="reps" initialValue={5} min={1} max={50} step={1} />
  ),
};

export const Timer = {
  render: () => (
    <Plain unit="sec" initialValue={30} min={5} max={300} step={5} />
  ),
};
