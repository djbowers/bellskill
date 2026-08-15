import { useModalityDebt, useWorkoutLogs } from '~/api';

import { ModalityBalance } from './ModalityBalance';

/**
 * Data-wired Training Mix card. Pulls modality debt and the user's workout
 * count (to gate the cold-start state) and hands them to the presentational
 * component.
 */
export const ModalityBalanceContainer = () => {
  const {
    data: balance,
    isLoading: balanceLoading,
    isError,
    refetch,
  } = useModalityDebt();
  const { data: workoutLogs, isLoading: logsLoading } = useWorkoutLogs();

  return (
    <ModalityBalance
      balance={balance}
      workoutCount={workoutLogs?.length ?? 0}
      isLoading={balanceLoading || logsLoading}
      isError={isError}
      onRetry={() => refetch()}
    />
  );
};
