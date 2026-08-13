import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { cn } from '~/lib/utils';
import { WeightTabValue } from '~/types';
import { WEIGHT_MODE_LABELS, WEIGHT_MODE_SHORT_LABELS } from '~/utils';

import { KettlebellGlyph } from './KettlebellGlyph';

interface WeightModeTabsProps {
  value: WeightTabValue;
  onValueChange: (value: WeightTabValue) => void;
  className?: string;
  hideNone?: boolean;
  /** Render as a read-only indicator of a mode determined elsewhere. */
  disabled?: boolean;
}

const MODES: WeightTabValue[] = ['none', '2h', '1h', 'double'];

export const WeightModeTabs = ({
  value,
  onValueChange,
  className,
  hideNone = false,
  disabled = false,
}: WeightModeTabsProps) => (
  <Tabs
    value={value}
    onValueChange={(next) => onValueChange(next as WeightTabValue)}
    className={cn('w-full', className)}
  >
    <TabsList className="flex w-full">
      {MODES.filter((mode) => !(hideNone && mode === 'none')).map((mode) => (
        <TabsTrigger
          key={mode}
          aria-label={WEIGHT_MODE_LABELS[mode]}
          className={cn(
            'flex min-w-0 flex-1 flex-col gap-0.5 px-0.5 py-1',
            disabled && 'data-[state=active]:opacity-100',
          )}
          size="sm"
          value={mode}
          disabled={disabled}
        >
          <KettlebellGlyph mode={mode} />
          <span className="truncate leading-none">
            {WEIGHT_MODE_SHORT_LABELS[mode]}
          </span>
        </TabsTrigger>
      ))}
    </TabsList>
  </Tabs>
);
