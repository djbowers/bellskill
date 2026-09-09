import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { useSession } from '~/contexts';

import { SkillNodeStatus, upsertSkillNodeStatus } from './skillNodeProgress';

export interface SetSkillNodeStatusArgs {
  nodeId: string;
  status: SkillNodeStatus;
}

export const useSetSkillNodeStatus = () => {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session?.user?.id;

  return useMutation({
    mutationFn: ({ nodeId, status }: SetSkillNodeStatusArgs) => {
      if (!userId) return Promise.resolve();
      return upsertSkillNodeStatus(userId, nodeId, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERIES.SKILL_NODE_PROGRESS],
      });
    },
  });
};
