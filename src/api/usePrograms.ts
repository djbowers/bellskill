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
 * Program cadence (`numWeeks`/`daysPerWeek`) prefers the stored columns when a
 * program authored them (e.g. the seeded shared programs) and otherwise
 * **derives from each program's own sessions** (PROD-237): the highest week
 * number and the widest week's day count. User-created programs leave those
 * columns null because the create form no longer asks, so they fall through to
 * derivation. Sessions are embedded in the same query, so this stays a single
 * round-trip.
 */
export const usePrograms = () => {
  const session = useSession();
  const userId = session?.user?.id;

  return useQuery([QUERIES.PROGRAMS, userId], () => fetchPrograms(userId!), {
    enabled: !!userId,
  });
};

type SessionCadenceRow = { week_number: number; day_number: number };

type StoredCadence = { num_weeks: number | null; days_per_week: number | null };

/**
 * Prefers the stored cadence columns when authored; otherwise derives the
 * highest week / widest week across a program's sessions (null when none).
 */
const resolveCadence = (
  { num_weeks, days_per_week }: StoredCadence,
  sessions: SessionCadenceRow[],
) => ({
  numWeeks:
    num_weeks ??
    (sessions.length ? Math.max(...sessions.map((s) => s.week_number)) : null),
  daysPerWeek:
    days_per_week ??
    (sessions.length ? Math.max(...sessions.map((s) => s.day_number)) : null),
});

const fetchPrograms = async (userId: string): Promise<Program[]> => {
  const { data, error } = await supabase
    .from('programs')
    .select('*, program_sessions(week_number, day_number)')
    .or(`owner_id.eq.${userId},is_public.eq.true`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(({ program_sessions, ...row }) => ({
    ...mapProgramRow(row),
    ...resolveCadence(row, program_sessions ?? []),
  }));
};
