import { useQuery } from 'react-query';

import { QUERIES } from '~/constants';
import { useSession } from '~/contexts';
import { Program, UserProgram } from '~/types';

import { supabase } from '../supabaseClient';
import { mapProgramRow, mapUserProgramRow } from './program';

export interface ActiveProgram {
  enrollment: UserProgram;
  program: Program;
}

/**
 * The user's currently active enrollment (there is at most one, enforced by the
 * `one_active_program_per_user` partial unique index), joined to its program.
 * Returns `null` when the user has no active program.
 *
 * Slice 2 uses this only to drive the "switch active program?" prompt on
 * enroll; Slice 3 extends the surface with the next-session lookup.
 */
export const useActiveProgram = () => {
  const session = useSession();
  const userId = session?.user?.id;

  return useQuery(
    [QUERIES.ACTIVE_PROGRAM, userId],
    () => fetchActiveProgram(userId!),
    { enabled: !!userId },
  );
};

const fetchActiveProgram = async (
  userId: string,
): Promise<ActiveProgram | null> => {
  const { data: enrollment, error } = await supabase
    .from('user_programs')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) throw error;
  if (!enrollment) return null;

  const { data: program, error: programError } = await supabase
    .from('programs')
    .select('*')
    .eq('id', enrollment.program_id)
    .single();

  if (programError) throw programError;

  return {
    enrollment: mapUserProgramRow(enrollment),
    program: mapProgramRow(program),
  };
};
