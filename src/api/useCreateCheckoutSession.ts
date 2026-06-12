import { useMutation } from 'react-query';

import { supabase } from '../supabaseClient';

export type CheckoutPlan = 'monthly' | 'yearly';

const createCheckoutSession = async (plan: CheckoutPlan): Promise<string> => {
  const { data, error } = await supabase.functions.invoke<{ url: string }>(
    'create-checkout-session',
    { body: { plan } },
  );

  if (error) throw error;
  if (!data?.url) throw new Error('No checkout URL returned');

  return data.url;
};

/**
 * Calls the create-checkout-session Edge Function and resolves to the Stripe
 * Checkout URL. The caller is responsible for the redirect — the full CTA →
 * redirect → return flow lands in PROD-106.
 */
export const useCreateCheckoutSession = () =>
  useMutation((plan: CheckoutPlan) => createCheckoutSession(plan));
