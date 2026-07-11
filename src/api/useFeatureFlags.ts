import { useQuery } from 'react-query';

import { isPreviewingAllFeatures } from '~/config/features';
import {
  ALL_EXPERIMENT_FEATURES_ON,
  EXPERIMENT_FLAG_KEYS,
  ExperimentFeatures,
  ExperimentFlagKey,
  resolveExperimentFeatures,
  SAFE_DEFAULT_FEATURES,
} from '~/config/experiments';
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
export const fetchExperimentFeatures = async (): Promise<ExperimentFeatures> => {
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

/**
 * Resolves the migrated experiment flags for the current user at runtime.
 *
 * Returns the app-facing boolean record (`curatedFirstWorkout`, `repeatPrevious`,
 * `recommender`). While the query loads, on error, or when unauthenticated it
 * returns the safe default (all OFF / pure builder), so production behavior is
 * unchanged until a flag is deliberately toggled. Owners previewing all features
 * (see `~/config/features`) get every experiment feature forced on, mirroring
 * `getFeatures()`.
 */
export const useFeatureFlags = (): ExperimentFeatures => {
  const session = useSession();
  const userId = session?.user?.id;

  const query = useQuery(
    [QUERIES.FEATURE_FLAGS, userId],
    fetchExperimentFeatures,
    {
      // Only evaluate for a signed-in user; unauthenticated resolves to the
      // safe default below (the RPC would return control anyway).
      enabled: !!userId,
      // Show the safe default (all OFF) on first render so the page opens in
      // control with no builder→browse flash; a real fetch still runs.
      placeholderData: SAFE_DEFAULT_FEATURES,
      // Assignment is server-sticky, so there's nothing to gain from refetching.
      staleTime: Infinity,
    },
  );

  // Owner preview override: force every experiment feature on so owners can
  // preview in-progress surfaces in production, matching getFeatures().
  if (isPreviewingAllFeatures(session)) {
    return ALL_EXPERIMENT_FEATURES_ON;
  }

  // `data` is the placeholder while loading and undefined after a terminal
  // error — both fall back to the safe default (control / OFF).
  return query.data ?? SAFE_DEFAULT_FEATURES;
};
