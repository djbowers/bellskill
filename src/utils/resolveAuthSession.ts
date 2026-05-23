import { Session } from '@supabase/supabase-js';

import { supabase } from '~/supabaseClient';

async function findProfile(userId: string) {
  return supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
}

async function ensureProfile(session: Session) {
  const { data: profile, error: profileError } = await findProfile(session.user.id);

  if (profileError) {
    return session;
  }

  if (profile) {
    return session;
  }

  const { error: insertError } = await supabase.from('profiles').insert({
    id: session.user.id,
    full_name: session.user.user_metadata?.full_name ?? null,
    avatar_url: session.user.user_metadata?.avatar_url ?? null,
  });

  if (!insertError) {
    return session;
  }

  if (insertError.code === '23505') {
    return session;
  }

  if (insertError.code === '23503') {
    await supabase.auth.signOut();
    return null;
  }

  return session;
}

/** Ensure the signed-in user has a profile; sign out only stale JWTs. */
export async function resolveAuthSession(
  session: Session | null,
): Promise<Session | null> {
  if (!session?.user) {
    return session;
  }

  return ensureProfile(session);
}

/** True when a 23503 FK violation references the auth user, not catalog rows. */
export function isStaleAuthUserForeignKey(error: {
  code?: string;
  message?: string;
  details?: string;
}): boolean {
  if (error.code !== '23503') {
    return false;
  }

  const haystack = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  return (
    haystack.includes('user_id') ||
    haystack.includes('auth.users') ||
    haystack.includes('user_movements_user_id_fkey')
  );
}

export async function signOutIfStaleAuthUser(error: {
  code?: string;
  message?: string;
  details?: string;
}): Promise<boolean> {
  if (!isStaleAuthUserForeignKey(error)) {
    return false;
  }

  await supabase.auth.signOut();
  return true;
}
