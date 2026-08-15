import clsx from 'clsx';
import { useEffect, useState } from 'react';

import { formatLapDelta } from '../utils';

/** Long enough to read between rounds, short enough to be gone before the next set. */
const VISIBLE_MS = 3000;

interface LapDeltaPillProps {
  /** Signed ms against the ghost's same round. Negative is faster. */
  deltaMs: number;
  /** Changes on every completed round, including one that ties the last. */
  lapKey: number;
}

/**
 * The lap-time popup: the verdict on the round just finished.
 *
 * Fires on each round completion and then gets out of the way. The rail says
 * where you are; this says what the last lap cost or bought. It carries the
 * number so pace never depends on colour alone.
 */
export const LapDeltaPill = ({ deltaMs, lapKey }: LapDeltaPillProps) => {
  const [visible, setVisible] = useState(true);

  useEffect(
    function hideAfterDelay() {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), VISIBLE_MS);
      return () => clearTimeout(timer);
    },
    // Re-runs per lap, so a round finished inside the previous pill's window
    // restarts the clock instead of inheriting its remainder.
    [lapKey],
  );

  if (!visible) return null;

  const isFaster = deltaMs < 0;
  const isEven = Math.round(Math.abs(deltaMs) / 1000) === 0;

  return (
    <div
      className="flex items-center justify-center gap-1 motion-safe:animate-in motion-safe:fade-in"
      data-testid="lap-delta-pill"
    >
      <span
        className={clsx(
          'rounded-full px-1 py-0.5 font-mono text-sm font-semibold',
          isEven && 'bg-accent text-accent-foreground',
          !isEven && isFaster && 'bg-status-success text-background',
          !isEven && !isFaster && 'bg-status-warning text-background',
        )}
      >
        {formatLapDelta(deltaMs)}
      </span>
      <span className="text-xs text-muted-foreground">
        {isEven ? 'matched last round' : isFaster ? 'faster' : 'slower'}
      </span>
    </div>
  );
};
