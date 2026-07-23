import { useCallback, useEffect, useRef, useState } from 'react';

const SETTLE_DELAY = 150; // ms

/** Gestures that mean the scroll about to happen came from the user. */
const USER_SCROLL_EVENTS = [
  'pointerdown',
  'touchstart',
  'wheel',
  'keydown',
] as const;

const supportsScrollEnd =
  typeof window !== 'undefined' && 'onscrollend' in window;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const nearestIndex = (values: number[], value: number) => {
  let nearest = 0;
  let shortest = Infinity;
  values.forEach((candidate, index) => {
    const distance = Math.abs(candidate - value);
    if (distance < shortest) {
      shortest = distance;
      nearest = index;
    }
  });
  return nearest;
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

interface UseSnapScrollValueOptions {
  itemWidth: number;
  onChange: (value: number) => void;
  onFocusChange?: (value: number) => void;
  value: number;
  values: number[];
}

/**
 * Two-way sync between a scroll-snap track and a controlled numeric value.
 *
 * A settle only commits when the user caused the scroll *and* it landed
 * somewhere other than where the value prop put us. Both halves matter: the
 * first keeps our own scrolling from echoing back through `onChange`, and the
 * second leaves an out-of-range value alone rather than silently snapping it in.
 *
 * `values` and `onFocusChange` must be referentially stable — memoize them, or
 * the sync effect will fight every render.
 */
export const useSnapScrollValue = ({
  itemWidth,
  onChange,
  onFocusChange,
  value,
  values,
}: UseSnapScrollValueOptions) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const syncedIndex = useRef(nearestIndex(values, value));
  const hasPositioned = useRef(false);
  const pendingUserScroll = useRef(false);
  const [focusedIndex, setFocusedIndex] = useState(syncedIndex.current);

  // Reported live during a swipe so the consumer's center display can track the
  // finger rather than lagging until the scroll settles.
  const focus = useCallback(
    (index: number) => {
      setFocusedIndex(index);
      onFocusChange?.(values[index]);
    },
    [onFocusChange, values],
  );

  const indexFromScroll = useCallback(() => {
    const track = trackRef.current;
    // jsdom has no layout, so there is no scroll position to read.
    if (!track || track.clientWidth === 0) return null;
    return clamp(
      Math.round(track.scrollLeft / itemWidth),
      0,
      values.length - 1,
    );
  }, [itemWidth, values.length]);

  useEffect(() => {
    const index = nearestIndex(values, value);
    syncedIndex.current = index;
    setFocusedIndex(index);

    const scrollToSynced = (behavior: ScrollBehavior) =>
      trackRef.current?.scrollTo?.({ left: index * itemWidth, behavior });

    // On the first commit the track has no laid-out width yet, so scrollTo is a
    // no-op — place it on the next frame instead, and instantly, since there is
    // nothing to animate away from.
    if (!hasPositioned.current) {
      hasPositioned.current = true;
      const frame = requestAnimationFrame(() => scrollToSynced('auto'));
      return () => cancelAnimationFrame(frame);
    }

    scrollToSynced(prefersReducedMotion() ? 'auto' : 'smooth');
  }, [itemWidth, value, values]);

  const handleSettle = useCallback(() => {
    const index = indexFromScroll();
    if (index === null) return;
    focus(index);
    // A settle the user did not cause is the tail of our own scroll, or a
    // browser-fired one at position 0 before the strip was placed. Committing
    // either would overwrite the real value with whatever happens to be centered.
    const userDriven = pendingUserScroll.current;
    pendingUserScroll.current = false;
    if (!userDriven || index === syncedIndex.current) return;
    syncedIndex.current = index;
    onChange(values[index]);
  }, [focus, indexFromScroll, onChange, values]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const markUserScroll = () => {
      pendingUserScroll.current = true;
    };

    const handleScroll = () => {
      const index = indexFromScroll();
      if (index !== null) focus(index);
      if (supportsScrollEnd) return;
      clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(handleSettle, SETTLE_DELAY);
    };

    USER_SCROLL_EVENTS.forEach((type) =>
      track.addEventListener(type, markUserScroll, { passive: true }),
    );
    track.addEventListener('scroll', handleScroll, { passive: true });
    if (supportsScrollEnd) track.addEventListener('scrollend', handleSettle);

    return () => {
      clearTimeout(settleTimer.current);
      USER_SCROLL_EVENTS.forEach((type) =>
        track.removeEventListener(type, markUserScroll),
      );
      track.removeEventListener('scroll', handleScroll);
      track.removeEventListener('scrollend', handleSettle);
    };
  }, [focus, handleSettle, indexFromScroll]);

  return { focusedIndex, trackRef };
};
