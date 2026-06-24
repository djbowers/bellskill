import { Features, getFeatures } from '~/config/features';
import { useSession } from '~/contexts';

/**
 * Returns the effective feature flags for the current session, honoring the
 * owner-only "preview all features" override (see `~/config/features`).
 *
 * Prefer this over importing the static `features` object so that disabled
 * features become visible when an owner has enabled the preview override.
 */
export const useFeatures = (): Features => getFeatures(useSession());
