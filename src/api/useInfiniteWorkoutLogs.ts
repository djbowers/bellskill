import { useInfiniteQuery } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { WorkoutLog } from '~/types';
import { supabase } from '../supabaseClient';
import { mapWorkoutLogRow } from './mapWorkoutLogRow';

const PAGE_SIZE = 20;

interface WorkoutLogsPage {
  workoutLogs: WorkoutLog[];
  nextPage: number | undefined;
}

export const useInfiniteWorkoutLogs = () =>
  useInfiniteQuery({
    queryKey: [QUERIES.WORKOUT_LOGS_INFINITE],
    queryFn: fetchWorkoutLogsPage,
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });

const fetchWorkoutLogsPage = async ({
  pageParam,
}: {
  pageParam: number;
}): Promise<WorkoutLogsPage> => {
  const from = (pageParam - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count, error } = await supabase
    .from('workout_logs')
    .select('*', { count: 'exact' })
    .order('started_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error(error);
    throw error;
  }

  const totalCount = count ?? 0;
  const nextPage = to < totalCount - 1 ? pageParam + 1 : undefined;

  return {
    nextPage,
    workoutLogs: data.map(mapWorkoutLogRow),
  };
};
