import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { useSession } from '~/contexts';

import { createOrReuseUserMovement } from './userMovement';

interface CreateUserMovementInput {
  canonicalName: string;
  functionalMovementId?: string | null;
}

export const useCreateUserMovement = () => {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session?.user?.id;

  return useMutation({
    mutationFn: ({
      canonicalName,
      functionalMovementId,
    }: CreateUserMovementInput) => {
      if (!userId) return Promise.resolve(null);
      return createOrReuseUserMovement({
        userId,
        canonicalName,
        functionalMovementId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERIES.USER_MOVEMENTS] });
    },
  });
};
