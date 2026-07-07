import { useQuery } from 'react-query';

import { QUERIES } from '~/constants';
import { useSession } from '~/contexts';
import { Program } from '~/types';

import { supabase } from '../supabaseClient';
import { mapProgramRow } from './program';

/**
 * Lists the programs visible to the current user: their own programs plus any
 * public/shared programs (e.g. the seeded Dry Fighting Weight). RLS already
 * restricts reads to public-or-own, but the `.or()` keeps the intent explicit.
 */
export const usePrograms = () => {
  const session = useSession();
  const userId = session?.user?.id;

  return useQuery([QUERIES.PROGRAMS, userId], () => fetchPrograms(userId!), {
    enabled: !!userId,
  });
};

const fetchPrograms = async (userId: string): Promise<Program[]> => {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .or(`owner_id.eq.${userId},is_public.eq.true`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapProgramRow);
};
