import { cn } from '~/lib/utils';
import { WeightTabValue } from '~/types';
import { WEIGHT_MODE_LABELS } from '~/utils';

import { KettlebellGlyph } from './KettlebellGlyph';

/**
 * The weight mode as a fact rather than a choice — for movements whose grip the
 * catalog already settled, and for the shared bell, which is decided once for
 * the whole workout. Wears the same chip as the collapsed card's summary so a
 * read-only value never looks like a control you've been locked out of.
 */
export const WeightModeIndicator = ({
  mode,
  className,
}: {
  mode: WeightTabValue;
  className?: string;
}) => (
  <span
    className={cn(
      'inline-flex items-center gap-0.5 rounded-full bg-muted/70 px-1 py-0.5 text-xs font-medium',
      className,
    )}
  >
    <KettlebellGlyph mode={mode} />
    {WEIGHT_MODE_LABELS[mode]}
  </span>
);
