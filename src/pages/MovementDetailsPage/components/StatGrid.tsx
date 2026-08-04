import { MovementHistoryEntry } from '~/api';
import { WeightUnit } from '~/types';
import { getWeightUnitLabel } from '~/utils';

import { computeMovementStats, getLastTrainedLabel } from '../utils/stats';

export const StatGrid = ({
  history,
}: {
  history: MovementHistoryEntry[];
}) => {
  const stats = computeMovementStats(history);
  const lastTrainedLabel = getLastTrainedLabel(history);

  const heaviest =
    stats.heaviestWeightValue !== null
      ? `${stats.heaviestWeightValue} ${getWeightUnitLabel(
          stats.heaviestWeightUnit as WeightUnit,
        )}`
      : 'bw';

  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-lg border">
      <Stat label="Sessions" value={String(stats.sessionCount)} />
      <Stat label="Heaviest bell" value={heaviest} className="border-l" />
      <Stat
        label="Total reps"
        value={stats.totalReps.toLocaleString()}
        className="border-t"
      />
      <Stat
        label="Last trained"
        value={lastTrainedLabel ?? '—'}
        className="border-l border-t"
      />
    </div>
  );
};

const Stat = ({
  label,
  value,
  className = '',
}: {
  label: string;
  value: string;
  className?: string;
}) => (
  <div className={`flex flex-col items-center gap-0.5 p-1.5 ${className}`}>
    <div className="text-lg font-semibold tabular-nums">{value}</div>
    <div className="text-xs uppercase tracking-wide text-muted-foreground">
      {label}
    </div>
  </div>
);
