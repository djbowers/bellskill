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
 *
 * Program cadence (`numWeeks`/`daysPerWeek`) is **derived from each program's
 * own sessions** rather than the stored columns (PROD-237): the highest week
 * number and the widest week's day count. Sessions are embedded in the same
 * query, so this stays a single round-trip and the list's "X weeks · Y/week"
 * summary can never drift from the actual layout.
 */
export const usePrograms = () => {
  const session = useSession();
  const userId = session?.user?.id;

  return useQuery([QUERIES.PROGRAMS, userId], () => fetchPrograms(userId!), {
    enabled: !!userId,
  });
};

type SessionCadenceRow = { week_number: number; day_number: number };

/** Highest week / widest week across a program's sessions; null when none. */
const deriveCadence = (sessions: SessionCadenceRow[]) => {
  if (sessions.length === 0) return { numWeeks: null, daysPerWeek: null };
  return {
    numWeeks: Math.max(...sessions.map((s) => s.week_number)),
    daysPerWeek: Math.max(...sessions.map((s) => s.day_number)),
  };
};

const fetchPrograms = async (userId: string): Promise<Program[]> => {
  const { data, error } = await supabase
    .from('programs')
    .select('*, program_sessions(week_number, day_number)')
    .or(`owner_id.eq.${userId},is_public.eq.true`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(({ program_sessions, ...row }) => ({
    ...mapProgramRow(row),
    ...deriveCadence(program_sessions ?? []),
  }));
};
