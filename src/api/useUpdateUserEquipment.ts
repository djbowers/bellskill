import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';

import { UserEquipmentInput, updateUserEquipment } from './userEquipment';

interface UpdateUserEquipmentInput {
  id: string;
  input: UserEquipmentInput;
}

export const useUpdateUserEquipment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: UpdateUserEquipmentInput) =>
      updateUserEquipment(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERIES.USER_EQUIPMENT] });
    },
  });
};
