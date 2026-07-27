import { useCallback, useEffect, useRef, useState } from 'react';

const SETTLE_DELAY = 150; // ms

/** Gestures that mean the scroll about to happen came from the user. */
const USER_SCROLL_EVENTS = [
  'pointerdown',
  'touchstart',
  'wheel',
  'keydown',
] as const;

// Checked per-mount rather than at module load so tests can exercise the
// no-scrollend fallback (iOS Safari) by removing the property.
const supportsScrollEnd = () =>
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
  const programmaticScroll = useRef(false);
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

    const scrollToSynced = (behavior: ScrollBehavior) => {
      programmaticScroll.current = true;
      trackRef.current?.scrollTo?.({ left: index * itemWidth, behavior });
    };

    // Until the track has laid-out width, scrollTo is a no-op, and even after
    // that scroll snap can drag the strip off a target the items haven't laid
    // out under yet. Re-assert the position each frame until it actually
    // sticks (StrictMode remounts and off-screen mounts included), instantly,
    // since there is nothing to animate away from.
    if (!hasPositioned.current) {
      const target = index * itemWidth;
      let attempts = 0;
      let frame = requestAnimationFrame(function position() {
        const track = trackRef.current;
        if (pendingUserScroll.current || attempts++ > 120) return;
        if (track && track.clientWidth > 0) {
          if (Math.abs(track.scrollLeft - target) < 1) {
            hasPositioned.current = true;
            return;
          }
          track.scrollTo?.({ left: target, behavior: 'auto' });
        }
        frame = requestAnimationFrame(position);
      });
      return () => cancelAnimationFrame(frame);
    }

    scrollToSynced(prefersReducedMotion() ? 'auto' : 'smooth');
  }, [itemWidth, value, values]);

  // `final` distinguishes a scrollend (the scroll is truly over) from the
  // fallback timer, which can fire mid-fling — only a final settle may clear
  // the gesture flags, or a fling's real landing would be treated as our own
  // scroll and never commit.
  const handleSettle = useCallback(
    (final: boolean) => {
      const index = indexFromScroll();
      if (index === null) return;

      const userDriven = pendingUserScroll.current;
      const programmatic = programmaticScroll.current;
      if (final) {
        pendingUserScroll.current = false;
        programmaticScroll.current = false;
      }

      if (index === syncedIndex.current) {
        focus(index);
        return;
      }

      if (userDriven) {
        focus(index);
        syncedIndex.current = index;
        onChange(values[index]);
        return;
      }

      // Mid-flight tail of our own smooth scroll — let it finish on its own.
      if (programmatic) return;

      // A settle the user did not cause, away from the synced value — e.g. a
      // browser-fired one at position 0 before the strip was placed. Committing
      // it would overwrite the real value, so snap back to the value instead.
      focus(syncedIndex.current);
      trackRef.current?.scrollTo?.({
        left: syncedIndex.current * itemWidth,
        behavior: 'auto',
      });
    },
    [focus, indexFromScroll, itemWidth, onChange, values],
  );

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const scrollEndSupported = supportsScrollEnd();

    // A gesture arms the user flag, but only sticks if it actually scrolls:
    // a tap or dead drag disarms on release, or a later programmatic scroll's
    // settle would read as user-driven and commit whatever it landed on.
    let scrolledSinceGesture = false;

    const markUserScroll = () => {
      pendingUserScroll.current = true;
      scrolledSinceGesture = false;
    };

    const releaseGesture = () => {
      if (!scrolledSinceGesture) pendingUserScroll.current = false;
    };

    const handleScroll = () => {
      // Only track the finger. Focusing during our own smooth scroll re-windows
      // the strip mid-flight, which shifts the spacers and lets scroll snap
      // abort the animation short of the target.
      if (pendingUserScroll.current) {
        scrolledSinceGesture = true;
        const index = indexFromScroll();
        if (index !== null) focus(index);
      }
      if (scrollEndSupported) return;
      clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => handleSettle(false), SETTLE_DELAY);
    };

    const handleScrollEnd = () => handleSettle(true);

    USER_SCROLL_EVENTS.forEach((type) =>
      track.addEventListener(type, markUserScroll, { passive: true }),
    );
    track.addEventListener('pointerup', releaseGesture, { passive: true });
    track.addEventListener('pointercancel', releaseGesture, { passive: true });
    track.addEventListener('scroll', handleScroll, { passive: true });
    if (scrollEndSupported)
      track.addEventListener('scrollend', handleScrollEnd);

    return () => {
      clearTimeout(settleTimer.current);
      USER_SCROLL_EVENTS.forEach((type) =>
        track.removeEventListener(type, markUserScroll),
      );
      track.removeEventListener('pointerup', releaseGesture);
      track.removeEventListener('pointercancel', releaseGesture);
      track.removeEventListener('scroll', handleScroll);
      track.removeEventListener('scrollend', handleScrollEnd);
    };
  }, [focus, handleSettle, indexFromScroll]);

  return { focusedIndex, trackRef };
};
