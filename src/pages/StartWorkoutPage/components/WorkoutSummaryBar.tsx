import { ClockIcon } from '@heroicons/react/24/outline';

import { WeightUnit, WorkoutGoalUnits } from '~/types';
import { getBellColor, getWeightUnitLabel } from '~/utils';

export interface SummaryLoad {
  value: number;
  unit: WeightUnit | null;
}

const goalLabel = (goal: number, units: WorkoutGoalUnits): string => {
  if (units === 'minutes') return `${goal} min`;
  if (units === 'rounds') return `${goal} ${goal === 1 ? 'round' : 'rounds'}`;
  return `${goal} kg`;
};

const BellDot = ({ value, unit }: SummaryLoad) => {
  const color = getBellColor(value, unit);
  if (!color) return null;
  return (
    <span
      className="h-1 w-1 rounded-full ring-1 ring-black/20"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
};

/**
 * The at-a-glance recap that sits above the Start button: goal, movement count,
 * and the load range (with competition-color bell dots).
 */
export const WorkoutSummaryBar = ({
  workoutGoal,
  workoutGoalUnits,
  movementCount,
  loads,
}: {
  workoutGoal: number;
  workoutGoalUnits: WorkoutGoalUnits;
  movementCount: number;
  loads: SummaryLoad[];
}) => {
  const sorted = [...loads].sort((a, b) => a.value - b.value);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const unitLabel = min ? getWeightUnitLabel(min.unit) : '';
  const loadText = min
    ? min.value === max.value
      ? `${min.value} ${unitLabel}`
      : `${min.value}–${max.value} ${unitLabel}`
    : null;

  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 px-0.5 text-xs font-medium text-muted-foreground">
      <span className="inline-flex items-center gap-0.5">
        <ClockIcon className="h-2 w-2" aria-hidden />
        {goalLabel(workoutGoal, workoutGoalUnits)}
      </span>
      <span>
        {movementCount} {movementCount === 1 ? 'movement' : 'movements'}
      </span>
      {loadText && (
        <span className="inline-flex items-center gap-0.5">
          {min && <BellDot value={min.value} unit={min.unit} />}
          {loadText}
        </span>
      )}
    </div>
  );
};
