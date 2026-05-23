import { Session } from '@supabase/supabase-js';

import { supabase } from '~/supabaseClient';

/** Drop sessions whose user no longer exists (e.g. after a local db reset). */
export async function resolveAuthSession(
  session: Session | null,
): Promise<Session | null> {
  if (!session?.user) {
    return session;
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', session.user.id)
    .maybeSingle();

  if (error || !profile) {
    await supabase.auth.signOut();
    return null;
  }

  return session;
}

export async function signOutIfStaleAuthUser(error: {
  code?: string;
}): Promise<boolean> {
  if (error.code !== '23503') {
    return false;
  }

  await supabase.auth.signOut();
  return true;
}
