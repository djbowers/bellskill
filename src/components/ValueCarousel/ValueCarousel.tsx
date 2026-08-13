import { useMemo } from 'react';

import { cn } from '~/lib/utils';

import { useSnapScrollValue } from './useSnapScrollValue';

export const ITEM_WIDTH = 48; // px

const FADE_BY_DISTANCE = [1, 0.7, 0.42, 0.24];

/** Values kept in the DOM either side of center. Wide enough that a fling
 * cannot outrun a re-render before the next scroll event lands. */
const WINDOW_RADIUS = 12;

interface ValueCarouselProps {
  /** Return a color to chip a value with, or null to leave it uncoded. */
  chipColor?: (value: number) => string | null;
  /** Render a value as a symbol instead of a numeral; null keeps the numeral. */
  formatValue?: (value: number) => string | null;
  max: number;
  min: number;
  onChange: (value: number) => void;
  /** Fires continuously as the strip scrolls, before the value commits. */
  onFocusChange?: (value: number) => void;
  /** Tapping the already-centered value, as opposed to swiping to a new one. */
  onSelectCenter?: () => void;
  step: number;
  value: number;
}

/**
 * A center-snapping strip of values. The centered numeral is hidden and the
 * caliper marks where the consumer's own center display sits on top.
 */
export const ValueCarousel = ({
  chipColor,
  formatValue,
  max,
  min,
  onChange,
  onFocusChange,
  onSelectCenter,
  step,
  value,
}: ValueCarouselProps) => {
  const values = useMemo(() => {
    const range: number[] = [];
    for (let current = min; current <= max; current += step)
      range.push(current);
    return range;
  }, [max, min, step]);

  const { focusedIndex, trackRef } = useSnapScrollValue({
    itemWidth: ITEM_WIDTH,
    onChange,
    onFocusChange,
    value,
    values,
  });

  if (values.length === 0) return null;

  // Ranges run to a few hundred values (volume goes to 3000 by 10). Rendering
  // them all costs a full reconcile on every step, so keep the DOM to the
  // window either side of center and hold the scroll geometry open with spacers.
  const first = Math.max(0, focusedIndex - WINDOW_RADIUS);
  const last = Math.min(values.length - 1, focusedIndex + WINDOW_RADIUS);

  return (
    <div className="relative">
      <div
        ref={trackRef}
        aria-hidden="true"
        className="no-select flex snap-x snap-mandatory overflow-x-auto py-0.5 [-ms-overflow-style:none] [overscroll-behavior-x:contain] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ paddingInline: `calc(50% - ${ITEM_WIDTH / 2}px)` }}
      >
        <div className="shrink-0" style={{ width: first * ITEM_WIDTH }} />
        {values.slice(first, last + 1).map((current, offset) => {
          const index = first + offset;
          const distance = Math.abs(index - focusedIndex);
          const centered = distance === 0;
          const color = chipColor?.(current) ?? null;

          return (
            <button
              key={current}
              type="button"
              tabIndex={-1}
              onClick={() =>
                centered ? onSelectCenter?.() : onChange(current)
              }
              className="flex shrink-0 snap-center flex-col items-center gap-0.5"
              style={{
                width: ITEM_WIDTH,
                opacity: FADE_BY_DISTANCE[Math.min(distance, 3)],
              }}
            >
              <span
                className={cn(
                  'text-base tabular-nums',
                  centered
                    ? 'invisible font-medium text-foreground'
                    : 'text-muted-foreground',
                )}
              >
                {formatValue?.(current) ?? current}
              </span>
              {chipColor &&
                (color ? (
                  <span
                    className="h-[5px] w-2.5 rounded-sm border border-foreground/25"
                    style={{ background: color }}
                  />
                ) : (
                  <span className="h-[2px] w-1 rounded-sm bg-border" />
                ))}
            </button>
          );
        })}
        <div
          className="shrink-0"
          style={{ width: (values.length - 1 - last) * ITEM_WIDTH }}
        />
      </div>

      <div
        className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 rounded-sm border-x-2 border-primary"
        style={{ width: ITEM_WIDTH + 4 }}
      />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-card to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-card to-transparent" />
    </div>
  );
};
