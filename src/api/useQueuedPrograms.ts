import { useQuery } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { useSession } from '~/contexts';
import { Program, UserProgram } from '~/types';

import { supabase } from '../supabaseClient';
import { mapProgramRow, mapUserProgramRow } from './program';

export interface QueuedProgram {
  enrollment: UserProgram;
  program: Program;
}

/**
 * The user's queued enrollments in queue order — programs cloned and
 * weight-baked at queue time (see `enroll_in_program`'s `p_queue`), waiting for
 * `complete_program_session` to promote the front of the line into a freed
 * slot. Empty for users who never queue.
 */
export const useQueuedPrograms = () => {
  const session = useSession();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: [QUERIES.QUEUED_PROGRAMS, userId],
    queryFn: () => fetchQueuedPrograms(userId!),
    enabled: !!userId,
  });
};

const fetchQueuedPrograms = async (
  userId: string,
): Promise<QueuedProgram[]> => {
  const { data, error } = await supabase
    .from('user_programs')
    .select('*, programs(*)')
    .eq('user_id', userId)
    .eq('status', 'queued')
    .order('queue_position', { ascending: true });

  if (error) throw error;

  return (data ?? []).map(({ programs, ...enrollment }) => ({
    enrollment: mapUserProgramRow(enrollment),
    program: mapProgramRow(programs),
  }));
};
