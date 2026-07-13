/**
 * Runtime experiment flags (PROD-175).
 *
 * These migrated OFF the build-time `VITE_FEATURE_*` env vars (see
 * `~/config/features`) onto the Supabase `feature_flags` table + the
 * server-authoritative `evaluate_feature_flags` RPC, so a variant can be
 * assigned per user, stay sticky across sessions, and be toggled at runtime
 * WITHOUT a redeploy. The eval client lives in `~/api/useFeatureFlags`.
 *
 * The DB key is snake_case (matches `feature_flags.key`); the app-facing field
 * is camelCase (matches the former `FeatureName`, so consumers read the same
 * boolean shape they did under the env flags).
 */

export const EXPERIMENT_FLAG_KEYS = [
  'curated_first_workout',
  'repeat_previous',
  'recommender',
] as const;

export type ExperimentFlagKey = (typeof EXPERIMENT_FLAG_KEYS)[number];

/** The variant a flag resolves to. `control` is the safe/OFF state. */
export const CONTROL_VARIANT = 'control';
export const TREATMENT_VARIANT = 'treatment';

/** App-facing boolean record for the migrated experiment flags. */
export interface ExperimentFeatures {
  curatedFirstWorkout: boolean;
  repeatPrevious: boolean;
  recommender: boolean;
}

/** DB flag key → app-facing boolean field. */
const KEY_TO_FEATURE: Record<ExperimentFlagKey, keyof ExperimentFeatures> = {
  curated_first_workout: 'curatedFirstWorkout',
  repeat_previous: 'repeatPrevious',
  recommender: 'recommender',
};

/**
 * Safe default: every experiment feature OFF (control / pure builder). This is
 * what the app uses while the eval query loads, when the flags backend errors
 * or is unreachable, and in production until a flag is deliberately toggled —
 * so the app never crashes and never silently flips a user into treatment on
 * error.
 */
export const SAFE_DEFAULT_FEATURES: ExperimentFeatures = {
  curatedFirstWorkout: false,
  repeatPrevious: false,
  recommender: false,
};

/** Every experiment feature ON — used only for the owner preview override. */
export const ALL_EXPERIMENT_FEATURES_ON: ExperimentFeatures = {
  curatedFirstWorkout: true,
  repeatPrevious: true,
  recommender: true,
};

/**
 * Maps resolved variants (DB key → variant string) to the app-facing boolean
 * record. A feature is ON only when its flag resolved to `treatment`; anything
 * else — control, a missing key, an unknown variant — is OFF (the safe
 * default). Pure, so the eval client's resolution is unit-testable without a
 * backend.
 */
export const resolveExperimentFeatures = (
  variants: Partial<Record<ExperimentFlagKey, string>>,
): ExperimentFeatures => {
  const features: ExperimentFeatures = { ...SAFE_DEFAULT_FEATURES };
  for (const key of EXPERIMENT_FLAG_KEYS) {
    features[KEY_TO_FEATURE[key]] = variants[key] === TREATMENT_VARIANT;
  }
  return features;
};
