import { useQuery } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import type { ChalkMessage } from '~/types';

import { supabase } from '../supabaseClient';

const fetchChalkMessages = async (
  threadId: string,
): Promise<ChalkMessage[]> => {
  // Ordered by seq, not created_at: both rows of one turn are written by the
  // same request and can share a timestamp.
  const { data, error } = await supabase
    .from('chalk_messages')
    .select('id, thread_id, role, content, status, error, created_at')
    .eq('thread_id', threadId)
    .order('seq', { ascending: true });

  if (error) {
    console.error(error);
    throw error;
  }

  return (data ?? []).map((m) => ({
    id: m.id,
    threadId: m.thread_id,
    role: m.role as ChalkMessage['role'],
    content: m.content,
    status: m.status as ChalkMessage['status'],
    error: m.error,
    createdAt: m.created_at,
  }));
};

/** The persisted turns of one conversation. The server is the source of truth. */
export const useChalkMessages = (threadId: string | null) => {
  return useQuery({
    queryKey: [QUERIES.CHALK_MESSAGES, threadId],
    queryFn: () => fetchChalkMessages(threadId as string),
    enabled: !!threadId,
  });
};
