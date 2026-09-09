import { useQuery } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { useSession } from '~/contexts';

import { fetchSkillNodeProgress } from './skillNodeProgress';

export const useSkillNodeProgress = () => {
  const session = useSession();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: [QUERIES.SKILL_NODE_PROGRESS, userId],
    queryFn: () => fetchSkillNodeProgress(userId!),
    enabled: !!userId,
  });
};
