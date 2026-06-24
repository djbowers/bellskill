import { Session } from '@supabase/supabase-js';

export type FeatureName =
  | 'complexMode'
  | 'explore'
  | 'premium'
  | 'recommender'
  | 'weeklyBalance';

export type Features = Record<FeatureName, boolean>;

/**
 * Build-time feature flags — the "real" production state of each flag, driven
 * by env vars. This is what every user sees by default.
 */
const baseFeatures: Features = {
  complexMode: import.meta.env.VITE_FEATURE_COMPLEX_MODE === 'true',
  explore: import.meta.env.VITE_FEATURE_EXPLORE === 'true',
  premium: import.meta.env.VITE_FEATURE_PREMIUM === 'true',
  recommender: import.meta.env.VITE_FEATURE_RECOMMENDER === 'true',
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
 * flags for everyone, except owners who have enabled the preview override —
 * they get every flag forced on so they can view in-progress features in
 * production even when those flags are disabled.
 */
export const getFeatures = (session?: Session | null): Features => {
  if (isPreviewingAllFeatures(session)) {
    return {
      complexMode: true,
      explore: true,
      premium: true,
      recommender: true,
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
