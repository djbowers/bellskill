import { RepeatableWorkout, useRecentRepeatableWorkouts } from '~/api';
import { CURATED_WORKOUTS } from '~/constants';
import { CuratedWorkout } from '~/types';

/**
 * The recommendations shown above the workout builder on the Start page:
 * always the curated first workouts, plus repeats of the user's most recent
 * sessions once they have history ("always show both").
 */
export const useRecommendedWorkouts = (): {
  curated: CuratedWorkout[];
  recentRepeats: RepeatableWorkout[];
  isLoading: boolean;
} => {
  const { recentRepeats, isLoading } = useRecentRepeatableWorkouts();
  return { curated: CURATED_WORKOUTS, recentRepeats, isLoading };
};
