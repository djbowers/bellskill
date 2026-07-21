import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { useSession } from '~/contexts';
import { Program } from '~/types';

import { supabase } from '../supabaseClient';
import { mapProgramRow } from './program';
import { useProgramMutationErrorHandler } from './useProgramMutationErrorHandler';

export interface CreateProgramInput {
  title: string;
}

/**
 * Creates a new private, user-owned program (`is_public = false`). Cadence
 * (`num_weeks`/`days_per_week`) is left unset — it is derived from the program's
 * sessions once they exist (PROD-237). The returned {@link Program} is used to
 * navigate straight into the save-session builder.
 */
export const useCreateProgram = () => {
  const session = useSession();
  const queryClient = useQueryClient();
  const onError = useProgramMutationErrorHandler();
  const userId = session?.user?.id;

  return useMutation({
    mutationFn: async ({ title }: CreateProgramInput): Promise<Program> => {
      if (!userId) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('programs')
        .insert({
          owner_id: userId,
          title,
          is_public: false,
        })
        .select('*')
        .single();

      if (error) throw error;
      return mapProgramRow(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERIES.PROGRAMS] });
    },
    onError,
  });
};
