import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { useSession } from '~/contexts';

import { deleteSkillNodeProgress } from './skillNodeProgress';

export const useResetSkillNode = () => {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session?.user?.id;

  return useMutation({
    mutationFn: (nodeId: string) => {
      if (!userId) return Promise.resolve();
      return deleteSkillNodeProgress(userId, nodeId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERIES.SKILL_NODE_PROGRESS],
      });
    },
  });
};
