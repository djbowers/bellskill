import { ReactNode, useEffect, useState } from 'react';

import { useFeatureFlags } from '~/api';
import { Loading } from '~/components';

// Bounds the app-init flags splash to a fixed wall-clock cap, independent of
// `isPending` (react-query's `isPlaceholderData`), which has no timeout of
// its own for a slow-but-succeeding request. If this fires while the fetch is
// still in flight the app renders anyway — `useFeatureFlags()` already falls
// back to the safe default whenever not fully resolved, so there's no new
// fallback logic needed; a late-arriving real result just updates reactively.
export const FLAGS_TIMEOUT_MS = 1750;

interface FeatureFlagsGateProps {
  children: ReactNode;
}

/**
 * Loads feature flags once at app init, before any route renders, so every
 * downstream consumer of `useFeatureFlags()` (e.g. `StartWorkoutPage`) reads
 * an already-resolved, cached answer (`staleTime: Infinity`) instead of
 * racing its own pending state on every mount.
 */
export const FeatureFlagsGate = ({ children }: FeatureFlagsGateProps) => {
  const { isPending } = useFeatureFlags();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), FLAGS_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  if (isPending && !timedOut) return <Loading />;

  return <>{children}</>;
};
