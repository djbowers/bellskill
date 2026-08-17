import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { cn } from '~/lib/utils';

import { LegGlyph } from './LegGlyph';

/**
 * The leg axis as a peer of the weight axis, wearing the same glyph-over-label
 * trigger as WeightModeTabs. The weight mode is often settled by the catalog
 * and shown read-only; this one is always the lifter's call, so it keeps the
 * full-width tabs rather than collapsing to a chip.
 */
export const LegModeTabs = ({
  unilateral,
  onValueChange,
  className,
}: {
  unilateral: boolean;
  onValueChange: (unilateral: boolean) => void;
  className?: string;
}) => (
  <Tabs
    value={unilateral ? 'single' : 'both'}
    onValueChange={(next) => onValueChange(next === 'single')}
    className={cn('w-full', className)}
  >
    <TabsList className="flex w-full">
      <TabsTrigger
        aria-label="Both legs"
        className="flex min-w-0 flex-1 flex-col gap-0.5 px-0.5 py-1"
        size="sm"
        value="both"
      >
        <LegGlyph unilateral={false} />
        <span className="truncate leading-none">Both</span>
      </TabsTrigger>
      <TabsTrigger
        aria-label="One leg at a time"
        className="flex min-w-0 flex-1 flex-col gap-0.5 px-0.5 py-1"
        size="sm"
        value="single"
      >
        <LegGlyph unilateral />
        <span className="truncate leading-none">One at a time</span>
      </TabsTrigger>
    </TabsList>
  </Tabs>
);
