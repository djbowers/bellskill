import { Duration } from 'luxon';
import { useCallback, useEffect, useState } from 'react';

const DEFAULT_PAUSED = false;
const TIME_FORMAT = 'm:ss';

interface CountdownTimerOptions {
  defaultPaused?: boolean;
  disabled?: boolean;
  timeFormat?: string;
}

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

  useEffect(() => {
    if (options?.disabled || paused || initialTimer === 0) return;

    const timer = setInterval(() => {
      setMilliseconds((s) => s - 100);
    }, 100);
    return () => clearInterval(timer);
  }, [paused, options?.disabled, initialTimer]);

  const reset = useCallback(
    (timer: number = initialTimer) => setMilliseconds(timer * 60000),
    [initialTimer],
  );
  const pause = useCallback(() => setPaused(true), []);
  const play = useCallback(() => setPaused(false), []);

  const timeRemaining = Duration.fromObject({
    milliseconds,
  }).toFormat(options?.timeFormat || TIME_FORMAT);

  return [timeRemaining, { reset, milliseconds, pause, play, paused }] as const;
};
