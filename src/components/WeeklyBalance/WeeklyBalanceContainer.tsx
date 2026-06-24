import { usePatternDebt, useWorkoutLogs } from '~/api';

import { WeeklyBalance } from './WeeklyBalance';

/**
 * Data-wired Weekly Balance for use on the dashboard. Pulls pattern debt and
 * the user's workout count (to gate the cold-start state) and hands them to the
 * presentational component.
 */
export const WeeklyBalanceContainer = () => {
  const { data: balance, isLoading: balanceLoading } = usePatternDebt();
  const { data: workoutLogs, isLoading: logsLoading } = useWorkoutLogs();

  return (
    <WeeklyBalance
      balance={balance}
      workoutCount={workoutLogs?.length ?? 0}
      isLoading={balanceLoading || logsLoading}
    />
  );
};
