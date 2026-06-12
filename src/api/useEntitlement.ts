import { useQuery } from 'react-query';

import { QUERIES } from '~/constants';
import { useSession } from '~/contexts';

import { supabase } from '../supabaseClient';

/**
 * The subscription columns the client reads to derive access. The real gate is
 * server-side (has_premium_access + RLS, PROD-100); this is UX only.
 */
export interface SubscriptionRow {
  // NOT NULL in the DB (defaults to 'free'); keep non-nullable to match.
  subscription_tier: string;
  trial_ends_at: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
}

export interface Entitlement {
  isPremium: boolean;
  isTrialing: boolean;
  /** True only when a trial existed and has since lapsed (vs. never trialed). */
  trialExpired: boolean;
  trialDaysRemaining: number | null;
  effectiveAccess: 'premium' | 'free';
}

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Derives entitlement from a subscription row. Mirrors the SQL has_premium_access
 * rule exactly: premium = tier 'premium' OR (trial_ends_at set AND not yet past).
 * Kept pure so it can be unit-tested across all four states.
 */
export const deriveEntitlement = (
  row: SubscriptionRow | null,
  now: Date = new Date(),
): Entitlement => {
  const isPremium = row?.subscription_tier === 'premium';

  const trialEndsAt = row?.trial_ends_at ? new Date(row.trial_ends_at) : null;
  const trialActive =
    trialEndsAt !== null && now.getTime() < trialEndsAt.getTime();
  const isTrialing = !isPremium && trialActive;
  const trialExpired =
    trialEndsAt !== null && now.getTime() >= trialEndsAt.getTime();

  const trialDaysRemaining = trialActive
    ? Math.ceil((trialEndsAt!.getTime() - now.getTime()) / DAY_MS)
    : null;

  return {
    isPremium,
    isTrialing,
    trialExpired,
    trialDaysRemaining,
    effectiveAccess: isPremium || isTrialing ? 'premium' : 'free',
  };
};

const fetchSubscriptionRow = async (
  userId: string | undefined,
): Promise<SubscriptionRow | null> => {
  // refetch() bypasses react-query's `enabled` guard, so guard here too: without
  // a user there's nothing to read (derives to free, the safe default).
  if (!userId) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'subscription_tier, trial_ends_at, subscription_status, current_period_end',
    )
    .eq('id', userId)
    .single();

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
};

/**
 * Reads the user's subscription row and derives entitlement. Refetchable on
 * demand (needed for the Phase-2 post-checkout return flow).
 */
export const useEntitlementQuery = () => {
  const session = useSession();
  const userId = session?.user?.id;

  return useQuery(
    [QUERIES.ENTITLEMENT, userId],
    () => fetchSubscriptionRow(userId),
    { enabled: !!userId, select: (row) => deriveEntitlement(row) },
  );
};
