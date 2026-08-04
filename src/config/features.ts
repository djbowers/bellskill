import { Session } from '@supabase/supabase-js';

export type FeatureName =
  | 'bottomNav'
  | 'explore'
  | 'premium'
  | 'programs'
  | 'spotify'
  | 'weeklyBalance';

export type Features = Record<FeatureName, boolean>;

/**
 * Build-time feature flags — the "real" production state of each flag, driven
 * by env vars. This is what every user sees by default.
 *
 * NOTE: the experiment flags (curated first workout, repeat previous, AI
 * recommender) migrated OFF this build-time system onto the runtime
 * feature_flags mechanism (PROD-175) — see `~/config/experiments` and the
 * `useFeatureFlags` hook. They are resolved per user at runtime, not here.
 */
const baseFeatures: Features = {
  bottomNav: import.meta.env.VITE_FEATURE_BOTTOMNAV === 'true',
  explore: import.meta.env.VITE_FEATURE_EXPLORE === 'true',
  premium: import.meta.env.VITE_FEATURE_PREMIUM === 'true',
  programs: import.meta.env.VITE_FEATURE_PROGRAMS === 'true',
  spotify: import.meta.env.VITE_FEATURE_SPOTIFY === 'true',
  weeklyBalance: import.meta.env.VITE_FEATURE_WEEKLY_BALANCE === 'true',
};

/**
 * Accounts allowed to preview disabled features in production. The preview
 * override below is only honored for these users, so flipping the localStorage
 * key does nothing for anyone else.
 *
 * NOTE: these flags gate UI/route *visibility* only — they are not a security
 * boundary. Premium/paid capabilities must still be enforced server-side
 * (Supabase RLS + Stripe entitlement), so revealing them here cannot grant
 * paid access.
 */
const OWNER_EMAILS = ['daniel_bowers@icloud.com'];

const PREVIEW_STORAGE_KEY = 'bellskill:preview-all-features';

export const isOwner = (session?: Session | null): boolean => {
  const email = session?.user?.email;
  return !!email && OWNER_EMAILS.includes(email);
};

/**
 * Whether this build is a Netlify deploy preview. Set to 'true' only in the
 * deploy-preview Netlify context (see netlify.toml) — never in production or
 * local builds. Deploy previews force every feature flag on (and auto-sign-in,
 * see App.tsx) so a PR preview is immediately usable, independent of the
 * owner/localStorage preview override below.
 */
export const isDeployPreview = (): boolean =>
  import.meta.env.VITE_DEPLOY_PREVIEW === 'true';

export const isPreviewOverrideEnabled = (): boolean => {
  try {
    return localStorage.getItem(PREVIEW_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

export const setPreviewOverrideEnabled = (enabled: boolean): void => {
  try {
    if (enabled) localStorage.setItem(PREVIEW_STORAGE_KEY, 'true');
    else localStorage.removeItem(PREVIEW_STORAGE_KEY);
  } catch {
    /* localStorage unavailable (e.g. private mode) — ignore */
  }
};

/**
 * Whether the current session is actively previewing all features. True only
 * when an owner has opted in via the preview override.
 */
export const isPreviewingAllFeatures = (session?: Session | null): boolean =>
  isOwner(session) && isPreviewOverrideEnabled();

/**
 * Effective feature flags for the current session. Returns the base (env)
 * flags for everyone, except (a) deploy previews and (b) owners who have enabled
 * the preview override — both get every flag forced on so in-progress features
 * are visible even when those flags are disabled.
 */
export const getFeatures = (session?: Session | null): Features => {
  if (isDeployPreview() || isPreviewingAllFeatures(session)) {
    return {
      bottomNav: true,
      explore: true,
      premium: true,
      programs: true,
      spotify: true,
      weeklyBalance: true,
    };
  }
  return baseFeatures;
};

/**
 * Static, build-time flags (no override). Prefer the `useFeatures()` hook in
 * components so the owner preview override is respected; this export remains
 * for non-React / module-load contexts.
 */
export const features = baseFeatures;
