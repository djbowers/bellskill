import { cn } from '~/lib/utils';

import { LegGlyph } from './LegGlyph';

/**
 * The leg axis as a fact rather than a choice, for movements whose laterality
 * the catalog already settled. Wears the same chip as WeightModeIndicator so
 * the two axes read as peers, and only ever renders for per-leg work — most
 * movements are bilateral, and a row saying "Both legs" on every card would be
 * noise that makes the per-leg case harder to spot.
 */
export const LegModeIndicator = ({ className }: { className?: string }) => (
  <span
    className={cn(
      'inline-flex items-center gap-0.5 rounded-full bg-muted/70 px-1 py-0.5 text-xs font-medium',
      className,
    )}
  >
    <LegGlyph unilateral className="h-2.5 w-2.5" />
    Per leg
  </span>
);
