import { useMutation } from 'react-query';

import { supabase } from '../supabaseClient';

const createPortalSession = async (): Promise<string> => {
  const { data, error } = await supabase.functions.invoke<{ url: string }>(
    'create-portal-session',
  );

  if (error) throw error;
  if (!data?.url) throw new Error('No portal URL returned');

  return data.url;
};

/**
 * Calls the create-portal-session Edge Function and resolves to the Stripe
 * Customer Portal URL. The caller redirects to it.
 */
export const useCreatePortalSession = () =>
  useMutation(() => createPortalSession());
