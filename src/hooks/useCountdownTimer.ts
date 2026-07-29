import { Duration } from 'luxon';
import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_PAUSED = false;
const TIME_FORMAT = 'm:ss';
const TICK_MS = 100;

interface CountdownTimerOptions {
  defaultPaused?: boolean;
  disabled?: boolean;
  timeFormat?: string;
}

// Remaining time is derived from a wall-clock deadline rather than a
// decremented counter: browsers throttle intervals in background tabs, so a
// counter falls behind real time. Remaining is clamped at 0 — consumers key
// completion off `milliseconds === 0`, and a timestamp jump may skip past it.
export const useCountdownTimer = (
  /** Time to start counting down from in minutes */
  initialTimer: number,
  options: CountdownTimerOptions = {
    defaultPaused: DEFAULT_PAUSED,
    disabled: false,
    timeFormat: TIME_FORMAT,
  },
) => {
  const [milliseconds, setMilliseconds] = useState<number>(
    initialTimer * 60000,
  );
  const [paused, setPaused] = useState<boolean>(
    options?.defaultPaused || DEFAULT_PAUSED,
  );
  const remainingRef = useRef<number>(initialTimer * 60000);
  const resetCountRef = useRef<number>(0);
  const [epoch, setEpoch] = useState<number>(0);

  useEffect(() => {
    if (options?.disabled || paused || initialTimer === 0) return;

    const deadline = Date.now() + remainingRef.current;
    const remainingNow = () => Math.max(0, deadline - Date.now());
    const resetCount = resetCountRef.current;

    const timer = setInterval(() => {
      const remaining = remainingNow();
      remainingRef.current = remaining;
      setMilliseconds(remaining);
      if (remaining === 0) clearInterval(timer);
    }, TICK_MS);

    return () => {
      clearInterval(timer);
      // capture sub-tick remaining for pause, unless a reset superseded it
      if (resetCountRef.current === resetCount)
        remainingRef.current = remainingNow();
    };
  }, [paused, options?.disabled, initialTimer, epoch]);

  const reset = useCallback(
    (timer: number = initialTimer) => {
      remainingRef.current = timer * 60000;
      resetCountRef.current += 1;
      setMilliseconds(timer * 60000);
      setEpoch((e) => e + 1); // re-anchor the deadline if already running
    },
    [initialTimer],
  );
  const pause = useCallback(() => setPaused(true), []);
  const play = useCallback(() => setPaused(false), []);

  const timeRemaining = Duration.fromObject({
    milliseconds,
  }).toFormat(options?.timeFormat || TIME_FORMAT);

  return [timeRemaining, { reset, milliseconds, pause, play, paused }] as const;
};
