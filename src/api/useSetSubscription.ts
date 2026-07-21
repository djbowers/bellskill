import { useMutation } from '@tanstack/react-query';

import { supabase } from '../supabaseClient';

export type SubscriptionState = 'free' | 'premium' | 'trialing';

const setSubscription = async (state: SubscriptionState): Promise<void> => {
  const { error } = await supabase.functions.invoke('set-subscription', {
    body: { state },
  });

  if (error) throw error;
};

/**
 * Owner-only: flips the current user's subscription state via the
 * set-subscription Edge Function (free / premium / trialing). Used to QA the
 * premium vs free surfaces without going through Stripe. The function enforces
 * the owner check server-side; non-owners get a 403.
 */
export const useSetSubscription = () =>
  useMutation({
    mutationFn: (state: SubscriptionState) => setSubscription(state),
  });
