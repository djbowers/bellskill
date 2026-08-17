import { useQuery } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { useSession } from '~/contexts';
import type { ChalkThread } from '~/types';

import { supabase } from '../supabaseClient';

const fetchChalkThreads = async (): Promise<ChalkThread[]> => {
  // RLS scopes this to the caller's own threads.
  const { data, error } = await supabase
    .from('chalk_threads')
    .select('id, title, created_at, last_message_at')
    .order('last_message_at', { ascending: false });

  if (error) {
    console.error(error);
    throw error;
  }

  return (data ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    createdAt: t.created_at,
    lastMessageAt: t.last_message_at,
  }));
};

interface UseChalkThreadsOptions {
  /** Lets a caller defer the fetch until the list is actually shown. */
  enabled?: boolean;
}

/** The caller's conversations, most recently active first. */
export const useChalkThreads = ({
  enabled = true,
}: UseChalkThreadsOptions = {}) => {
  const session = useSession();

  return useQuery({
    queryKey: [QUERIES.CHALK_THREADS],
    queryFn: fetchChalkThreads,
    enabled: enabled && !!session?.user?.id,
  });
};
