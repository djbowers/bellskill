import { useCallback, useEffect, useRef, useState } from 'react';

const TICK_MS = 100;

/**
 * How long the current set has been running. A max timed rung has no
 * prescription to count down from — you hold until failure and tap Continue —
 * so the press itself is the measurement, and this is what it reads.
 *
 * Time spent paused or resting is excluded: you are not under the bell for
 * either, and counting them would inflate every hold that followed a break.
 */
export const useSetStopwatch = ({ running }: { running: boolean }) => {
  const accumulatedRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const [, forceTick] = useState(0);

  const read = useCallback(
    () =>
      accumulatedRef.current +
      (startedAtRef.current === null ? 0 : Date.now() - startedAtRef.current),
    [],
  );

  const reset = useCallback(() => {
    accumulatedRef.current = 0;
    startedAtRef.current = running ? Date.now() : null;
    forceTick((n) => n + 1);
  }, [running]);

  // Banking the elapsed span on the way down (rather than tracking a start time
  // and subtracting pauses later) keeps the arithmetic to one addition and makes
  // repeated pause/resume cycles compose for free.
  useEffect(() => {
    if (running) {
      if (startedAtRef.current === null) startedAtRef.current = Date.now();
      return;
    }
    if (startedAtRef.current !== null) {
      accumulatedRef.current += Date.now() - startedAtRef.current;
      startedAtRef.current = null;
    }
  }, [running]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => forceTick((n) => n + 1), TICK_MS);
    return () => clearInterval(id);
  }, [running]);

  return {
    /** Whole seconds held, for logging. */
    elapsedSeconds: Math.round(read() / 1000),
    /** Live milliseconds, for the display. */
    elapsedMilliseconds: read(),
    reset,
  };
};
