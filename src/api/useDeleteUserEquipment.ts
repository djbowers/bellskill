import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';

import { deleteUserEquipment } from './userEquipment';

export const useDeleteUserEquipment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteUserEquipment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERIES.USER_EQUIPMENT] });
    },
  });
};
