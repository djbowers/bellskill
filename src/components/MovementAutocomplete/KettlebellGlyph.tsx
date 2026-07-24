import { WeightTabValue } from '~/types';
import { cn } from '~/lib/utils';

// A single competition-bell silhouette: round body with the handle cut out.
const Bell = ({ x = 0, scale = 1 }: { x?: number; scale?: number }) => (
  <path
    transform={`translate(${x} 0) scale(${scale})`}
    fillRule="evenodd"
    clipRule="evenodd"
    d="M12 3c-2.2 0-4 1.8-4 4 0 .53.1 1.03.3 1.5C6.3 9.8 5 12 5 14.5a7 7 0 0 0 14 0c0-2.5-1.3-4.7-3.3-6 .2-.47.3-.97.3-1.5 0-2.2-1.8-4-4-4Zm0 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2Z"
  />
);

/**
 * Depicts a weight mode by its kettlebell setup: nobody-vs-bells is the thing a
 * lifter recognizes before reading. Two-hand and single both carry one bell (the
 * grip lives in the label); double carries two; bodyweight shows a lifter, no bell.
 */
export const KettlebellGlyph = ({
  mode,
  className,
}: {
  mode: WeightTabValue;
  className?: string;
}) => {
  const cls = cn('h-2.5 w-2.5', className);

  if (mode === 'none') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        className={cls}
        aria-hidden
      >
        <circle cx="12" cy="7" r="3.2" />
        <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
      </svg>
    );
  }

  if (mode === 'double') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={cls} aria-hidden>
        <g transform="translate(-2 5) scale(0.62)">
          <Bell />
        </g>
        <g transform="translate(9 5) scale(0.62)">
          <Bell />
        </g>
      </svg>
    );
  }

  // 2h and 1h: one bell.
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={cls} aria-hidden>
      <Bell />
    </svg>
  );
};
