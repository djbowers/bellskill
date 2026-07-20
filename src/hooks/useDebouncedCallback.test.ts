import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { useDebouncedCallback } from './useDebouncedCallback';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it('should call callback with value after delay', () => {
  const callback = vi.fn();
  const { result } = renderHook(() => useDebouncedCallback(callback, 500));

  act(() => {
    result.current('test');
  });

  expect(callback).not.toHaveBeenCalled();

  act(() => {
    vi.advanceTimersByTime(500);
  });

  expect(callback).toHaveBeenCalledWith('test');
});

it('should not call callback if value is undefined', () => {
  const callback = vi.fn();
  const { result } = renderHook(() => useDebouncedCallback(callback, 500));

  act(() => {
    result.current(undefined);
  });

  act(() => {
    vi.advanceTimersByTime(500);
  });

  expect(callback).not.toHaveBeenCalled();
});

it('should cancel previous timeout when new value is set', () => {
  const callback = vi.fn();
  const { result } = renderHook(() => useDebouncedCallback(callback, 500));

  act(() => {
    result.current('first');
  });

  act(() => {
    vi.advanceTimersByTime(250);
  });

  act(() => {
    result.current('second');
  });

  act(() => {
    vi.advanceTimersByTime(500);
  });

  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledWith('second');
});

it('should use default delay of 500ms if not specified', () => {
  const callback = vi.fn();
  const { result } = renderHook(() => useDebouncedCallback(callback));

  act(() => {
    result.current('test');
  });

  act(() => {
    vi.advanceTimersByTime(499);
  });

  expect(callback).not.toHaveBeenCalled();

  act(() => {
    vi.advanceTimersByTime(1);
  });

  expect(callback).toHaveBeenCalledWith('test');
});

it('should handle multiple rapid value changes', () => {
  const callback = vi.fn();
  const { result } = renderHook(() => useDebouncedCallback(callback, 500));

  act(() => {
    result.current('first');
    result.current('second');
    result.current('third');
  });

  act(() => {
    vi.advanceTimersByTime(500);
  });

  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledWith('third');
});

it('should cleanup timeout on unmount', () => {
  const callback = vi.fn();
  const { result, unmount } = renderHook(() =>
    useDebouncedCallback(callback, 500),
  );

  act(() => {
    result.current('test');
  });

  unmount();

  act(() => {
    vi.advanceTimersByTime(500);
  });

  expect(callback).not.toHaveBeenCalled();
});
