import { useQuery } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { Program, ProgramSession } from '~/types';

import { supabase } from '../supabaseClient';
import { mapProgramRow, mapProgramSessionRow } from './program';

export interface ProgramWithSessions {
  program: Program;
  /** Ordered by `sequenceIndex` ascending — the canonical session order. */
  sessions: ProgramSession[];
}

/**
 * Fetches a single program plus its ordered sessions. Used by the save-session
 * builder to compute the next `sequenceIndex`/week/day and to power the
 * duplicate helpers.
 */
export const useProgram = (programId?: string) => {
  return useQuery({
    queryKey: [QUERIES.PROGRAM, programId],
    queryFn: () => fetchProgram(programId!),
    enabled: !!programId,
  });
};

const fetchProgram = async (
  programId: string,
): Promise<ProgramWithSessions> => {
  const [programResult, sessionsResult] = await Promise.all([
    supabase.from('programs').select('*').eq('id', programId).single(),
    supabase
      .from('program_sessions')
      .select('*')
      .eq('program_id', programId)
      .order('sequence_index', { ascending: true }),
  ]);

  if (programResult.error) throw programResult.error;
  if (sessionsResult.error) throw sessionsResult.error;

  return {
    program: mapProgramRow(programResult.data),
    sessions: (sessionsResult.data ?? []).map(mapProgramSessionRow),
  };
};
