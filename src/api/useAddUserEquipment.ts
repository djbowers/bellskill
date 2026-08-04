import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { useSession } from '~/contexts';

import { UserEquipmentInput, insertUserEquipment } from './userEquipment';

export const useAddUserEquipment = () => {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session?.user?.id;

  return useMutation({
    mutationFn: (input: UserEquipmentInput) => {
      if (!userId) return Promise.resolve();
      return insertUserEquipment(userId, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERIES.USER_EQUIPMENT] });
    },
  });
};
