import { useCallback, useEffect, useRef } from 'react';

const STICK_THRESHOLD_PX = 80;

/**
 * Keeps a scroll container pinned to the bottom as content grows, unless the
 * reader has scrolled up to read something — in which case new content must not
 * yank them back down.
 */
export const useAutoScroll = <T>(dependency: T) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const stickToBottom = useRef(true);

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottom.current = distanceFromBottom < STICK_THRESHOLD_PX;
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !stickToBottom.current) return;
    el.scrollTop = el.scrollHeight;
  }, [dependency]);

  return { ref, onScroll };
};
