import { useEffect, useState } from 'react';

export function useDebouncedCallback<T>(
  callback: (value: T) => void,
  delay: number = 500,
) {
  const [value, setValue] = useState<T>();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (value !== undefined) callback(value);
    }, delay);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce must retrigger only on value; including the per-render callback/delay would reset the timer every render and defeat debouncing
  }, [value]);

  return setValue;
}
