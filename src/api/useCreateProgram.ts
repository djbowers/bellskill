import { useMutation, useQueryClient } from 'react-query';

import { QUERIES } from '~/constants';
import { useSession } from '~/contexts';
import { Program } from '~/types';

import { supabase } from '../supabaseClient';
import { mapProgramRow } from './program';
import { useProgramMutationErrorHandler } from './useProgramMutationErrorHandler';

export interface CreateProgramInput {
  title: string;
  numWeeks: number;
  daysPerWeek: number;
}

/**
 * Creates a new private, user-owned program (`is_public = false`). The returned
 * {@link Program} is used to navigate straight into the save-session builder.
 */
export const useCreateProgram = () => {
  const session = useSession();
  const queryClient = useQueryClient();
  const onError = useProgramMutationErrorHandler();
  const userId = session?.user?.id;

  return useMutation({
    mutationFn: async ({
      title,
      numWeeks,
      daysPerWeek,
    }: CreateProgramInput): Promise<Program> => {
      if (!userId) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('programs')
        .insert({
          owner_id: userId,
          title,
          num_weeks: numWeeks,
          days_per_week: daysPerWeek,
          is_public: false,
        })
        .select('*')
        .single();

      if (error) throw error;
      return mapProgramRow(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries([QUERIES.PROGRAMS]);
    },
    onError,
  });
};
