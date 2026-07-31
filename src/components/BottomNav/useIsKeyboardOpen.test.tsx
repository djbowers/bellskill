import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useIsKeyboardOpen } from './useIsKeyboardOpen';

const focusEvent = (
  type: 'focusin' | 'focusout',
  target: HTMLElement,
  relatedTarget: HTMLElement | null = null,
) => {
  const event = new FocusEvent(type, { bubbles: true, relatedTarget });
  Object.defineProperty(event, 'target', { value: target });
  document.dispatchEvent(event);
};

describe('useIsKeyboardOpen', () => {
  describe('focus fallback (no visualViewport)', () => {
    it('opens when a text input gains focus and closes when it blurs', () => {
      const input = document.createElement('input');
      const { result } = renderHook(() => useIsKeyboardOpen());
      expect(result.current).toBe(false);

      act(() => focusEvent('focusin', input));
      expect(result.current).toBe(true);

      act(() => focusEvent('focusout', input));
      expect(result.current).toBe(false);
    });

    it('ignores non-text inputs', () => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      const { result } = renderHook(() => useIsKeyboardOpen());

      act(() => focusEvent('focusin', checkbox));
      expect(result.current).toBe(false);
    });

    it('stays open when focus moves between text fields', () => {
      const first = document.createElement('input');
      const second = document.createElement('textarea');
      const { result } = renderHook(() => useIsKeyboardOpen());

      act(() => focusEvent('focusin', first));
      act(() => focusEvent('focusout', first, second));
      expect(result.current).toBe(true);
    });
  });

  describe('visualViewport signal', () => {
    let viewportHeight: number;
    let listeners: Set<() => void>;

    beforeEach(() => {
      viewportHeight = window.innerHeight;
      listeners = new Set();
      vi.stubGlobal('visualViewport', {
        get height() {
          return viewportHeight;
        },
        addEventListener: (_: string, listener: () => void) => {
          listeners.add(listener);
        },
        removeEventListener: (_: string, listener: () => void) => {
          listeners.delete(listener);
        },
      });
      vi.stubGlobal('requestAnimationFrame', (callback: () => void) => {
        callback();
        return 0;
      });
      vi.stubGlobal('cancelAnimationFrame', () => {});
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const resizeTo = (height: number) => {
      viewportHeight = height;
      listeners.forEach((listener) => listener());
    };

    it('opens when the viewport shrinks by more than the keyboard threshold', () => {
      const { result } = renderHook(() => useIsKeyboardOpen());
      expect(result.current).toBe(false);

      act(() => resizeTo(window.innerHeight - 300));
      expect(result.current).toBe(true);
    });

    it('closes when the viewport height is restored', () => {
      const { result } = renderHook(() => useIsKeyboardOpen());

      act(() => resizeTo(window.innerHeight - 300));
      act(() => resizeTo(window.innerHeight));
      expect(result.current).toBe(false);
    });

    it('ignores small shrinks like the URL bar', () => {
      const { result } = renderHook(() => useIsKeyboardOpen());

      act(() => resizeTo(window.innerHeight - 60));
      expect(result.current).toBe(false);
    });

    it('ignores text-input focus when visualViewport is available', () => {
      const input = document.createElement('input');
      const { result } = renderHook(() => useIsKeyboardOpen());

      act(() => focusEvent('focusin', input));
      expect(result.current).toBe(false);
    });
  });
});
