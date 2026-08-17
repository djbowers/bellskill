import { useNavigate } from 'react-router-dom';

import { useModalityDebt, usePatternDebt, useWorkoutLogs } from '~/api';
import { useFeatures } from '~/hooks';

import { TrainingBalance } from './TrainingBalance';

/**
 * Data-wired Balance card for the History page. Pulls pattern and modality
 * debt (each behind its own flag) plus the user's workout count (to gate the
 * cold-start state) and hands them to the presentational component.
 */
export const TrainingBalanceContainer = () => {
  const features = useFeatures();
  const patterns = usePatternDebt({ enabled: features.weeklyBalance });
  const modalities = useModalityDebt({ enabled: features.modalityBalance });
  const { data: workoutLogs, isLoading: logsLoading } = useWorkoutLogs();
  const navigate = useNavigate();

  const showPatterns = features.weeklyBalance;
  const showModalities = features.modalityBalance;

  const isLoading =
    logsLoading ||
    (showPatterns && patterns.isLoading) ||
    (showModalities && modalities.isLoading);
  const isError =
    (showPatterns && patterns.isError) ||
    (showModalities && modalities.isError);

  return (
    <TrainingBalance
      patternBalance={patterns.data}
      modalityBalance={modalities.data}
      showPatterns={showPatterns}
      showModalities={showModalities}
      workoutCount={workoutLogs?.length ?? 0}
      isLoading={isLoading}
      isError={isError}
      onRetry={() => {
        if (patterns.isError) patterns.refetch();
        if (modalities.isError) modalities.refetch();
      }}
      onBalanceMe={() => navigate('/')}
    />
  );
};
