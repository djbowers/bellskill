import { useQuery } from '@tanstack/react-query';

import {
  ALL_EXPERIMENT_FEATURES_ON,
  EXPERIMENT_FLAG_KEYS,
  ExperimentFeatures,
  ExperimentFlagKey,
  SAFE_DEFAULT_FEATURES,
  resolveExperimentFeatures,
} from '~/config/experiments';
import { isDeployPreview, isPreviewingAllFeatures } from '~/config/features';
import { QUERIES } from '~/constants';
import { useSession } from '~/contexts';

import { supabase } from '../supabaseClient';

/**
 * Calls the server-authoritative `evaluate_feature_flags` RPC and maps the
 * resolved variants to the app-facing boolean record. The RPC assigns (and
 * persists) a sticky variant on first eval and reads it back thereafter, so the
 * bucket is decided on the server and cannot drift or be tampered client-side.
 *
 * Throws on any transport/RLS error so react-query surfaces it; the hook then
 * falls back to the safe default (control / OFF) — the eval client never flips
 * a user into treatment on error.
 */
export const fetchExperimentFeatures =
  async (): Promise<ExperimentFeatures> => {
    const { data, error } = await supabase.rpc('evaluate_feature_flags', {
      p_flag_keys: [...EXPERIMENT_FLAG_KEYS],
    });
    if (error) throw error;

    const variants: Partial<Record<ExperimentFlagKey, string>> = {};
    for (const row of data ?? []) {
      variants[row.flag_key as ExperimentFlagKey] = row.variant;
    }
    return resolveExperimentFeatures(variants);
  };

export interface FeatureFlagsResult {
  /** App-facing boolean record for the migrated experiment flags. */
  features: ExperimentFeatures;
  /**
   * True only while the eval query is still resolving for a signed-in user —
   * i.e. the returned `features` is the safe-default placeholder standing in
   * for a not-yet-known answer, not a settled one. It is distinct from the
   * error path: a terminal error resolves to the safe default with
   * `isPending === false`. Consumers use this to hold UI in a neutral state
   * until the real variants land, instead of committing to control on the
   * async placeholder. Unauthenticated and owner-preview both resolve
   * immediately (`isPending === false`).
   */
  isPending: boolean;
}

/**
 * Resolves the migrated experiment flags for the current user at runtime.
 *
 * Returns the app-facing boolean record (`curatedFirstWorkout`, `repeatPrevious`,
 * `recommender`) alongside an `isPending` gate. While the query loads, on error,
 * or when unauthenticated `features` is the safe default (all OFF / pure
 * builder), so production behavior is unchanged until a flag is deliberately
 * toggled. Owners previewing all features (see `~/config/features`) get every
 * experiment feature forced on, mirroring `getFeatures()`.
 */
export const useFeatureFlags = (): FeatureFlagsResult => {
  const session = useSession();
  const userId = session?.user?.id;

  const query = useQuery({
    queryKey: [QUERIES.FEATURE_FLAGS, userId],
    queryFn: fetchExperimentFeatures,
    // Only evaluate for a signed-in user; unauthenticated resolves to the
    // safe default below (the RPC would return control anyway).
    enabled: !!userId,
    // Show the safe default (all OFF) on first render so the page opens in
    // control with no builder→browse flash; a real fetch still runs.
    placeholderData: SAFE_DEFAULT_FEATURES,
    // Assignment is server-sticky, so there's nothing to gain from refetching.
    staleTime: Infinity,
    // StartWorkoutPage holds a blocking skeleton until this settles, so bound
    // the worst case: one quick retry (~1s) instead of react-query's default
    // 3 retries with exponential backoff (~7s) degrading the core flow on a
    // flags-backend hiccup. Failure still resolves to the safe default.
    retry: 1,
    retryDelay: 750,
  });

  // Force every experiment feature on for deploy previews and for owners who
  // enabled the preview override, so in-progress surfaces are visible — matching
  // getFeatures().
  if (isDeployPreview() || isPreviewingAllFeatures(session)) {
    return { features: ALL_EXPERIMENT_FEATURES_ON, isPending: false };
  }

  return {
    // `data` is the placeholder while loading and undefined after a terminal
    // error — both fall back to the safe default (control / OFF).
    features: query.data ?? SAFE_DEFAULT_FEATURES,
    // `placeholderData` makes react-query report `status: 'success'` from the
    // first render, so `isPlaceholderData` (not `isLoading`) is what marks the
    // initial fetch: true only while the placeholder stands in, false once the
    // real variants land AND after a terminal error. Guarded on `userId`
    // because a disabled (unauthenticated) query also holds the placeholder,
    // yet its answer is already settled at the safe default.
    isPending: !!userId && query.isPlaceholderData,
  };
};
