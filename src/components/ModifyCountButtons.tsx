import { MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import { ReactNode, useCallback, useRef, useState } from 'react';

import { ITEM_WIDTH, ValueCarousel } from '~/components/ValueCarousel';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { cn } from '~/lib/utils';
import { WeightUnit } from '~/types';
import { getBellColor } from '~/utils';

interface ModifyCountButtonsProps {
  /** Color the strip with the competition bell code for this unit. */
  bellUnit?: WeightUnit | null;
  /**
   * Names what this control counts, e.g. "Deload weeks bell 1". Required when a
   * page shows more than one — without it every instance shares the `- ${unit}` /
   * `+ ${unit}` button names and an unnamed input.
   */
  label?: string;
  max?: number;
  min?: number;
  onChange: (value: number) => void;
  onClickMinus: () => void;
  onClickPlus: () => void;
  step?: number;
  unit: string;
  unitTabs?: ReactNode;
  value: number;
}

export const ModifyCountButtons = ({
  bellUnit,
  label,
  max = 100,
  min = 0,
  onChange,
  onClickMinus,
  onClickPlus,
  step = 1,
  unit,
  unitTabs,
  value,
}: ModifyCountButtonsProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);

  // The strip scrolls under the input, so the input shows where the finger is
  // rather than the last committed value.
  const [displayValue, setDisplayValue] = useState(value);
  const [committedValue, setCommittedValue] = useState(value);
  if (committedValue !== value) {
    setCommittedValue(value);
    setDisplayValue(value);
  }

  const qualify = (action: string) =>
    label ? `${action} ${unit} — ${label}` : `${action} ${unit}`;
  const handleChangeValue = (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange(Number(e.target.value));

  const startEditing = useCallback(() => {
    setEditing(true);
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const chipColor = useCallback(
    (current: number) => getBellColor(current, bellUnit ?? null),
    [bellUnit],
  );

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <Button size="icon" onClick={onClickMinus} aria-label={qualify('-')}>
          <MinusIcon className="h-2.5 w-2.5" />
        </Button>

        <div className="relative min-w-0 flex-1">
          <ValueCarousel
            chipColor={bellUnit ? chipColor : undefined}
            max={max}
            min={min}
            onChange={onChange}
            onFocusChange={setDisplayValue}
            onSelectCenter={startEditing}
            step={step}
            value={value}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0.5 flex justify-center">
            <Input
              ref={inputRef}
              type="number"
              aria-label={label}
              value={displayValue}
              onChange={handleChangeValue}
              onBlur={() => setEditing(false)}
              style={{ width: ITEM_WIDTH }}
              className={cn(
                'h-3 border-0 bg-transparent px-0 py-0 text-center font-medium shadow-none',
                '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                editing && 'pointer-events-auto',
              )}
            />
          </div>
        </div>

        <Button size="icon" onClick={onClickPlus} aria-label={qualify('+')}>
          <PlusIcon className="h-2.5 w-2.5" />
        </Button>
      </div>

      <div className="flex justify-center">
        {unitTabs ?? <div className="text-sm text-foreground">{unit}</div>}
      </div>
    </div>
  );
};
