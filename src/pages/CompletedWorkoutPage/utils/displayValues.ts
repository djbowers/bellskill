import { MovementLog, WeightUnit } from '~/types';
import { getWeightUnitLabel } from '~/utils';

export const getWeightsDisplayValue = (
  weightOneValue: number | null,
  weightOneUnit: string | null,
  weightTwoValue: number | null,
  weightTwoUnit: string | null,
) => {
  if (weightOneValue === null && weightTwoValue === null) return 'bw';
  const weightOne = weightOneValue
    ? `${weightOneValue} ${getWeightUnitLabel(weightOneUnit as WeightUnit)}`
    : '';
  const weightTwo = weightTwoValue
    ? `${weightTwoValue} ${getWeightUnitLabel(weightTwoUnit as WeightUnit)}`
    : '';
  const hands =
    weightTwoValue === null ? '(2h)' : weightTwoValue === 0 ? '(1h)' : '';
  return `${weightOne}${weightTwo ? ', ' : ''}${weightTwo}${
    hands ? ' ' : ''
  }${hands}`;
};

export const getRepSchemeDisplayValue = (
  repScheme: number[],
  weights: [number | null, number | null],
) =>
  repScheme.reduce((reps, rung) => {
    const unilateral = (weights[0] ?? 0) > 0 && weights[1] === 0;
    const rungDisplayValue = unilateral ? `${rung} / ${rung}` : rung.toString();
    if (reps === '') return rungDisplayValue;
    return reps + ', ' + rungDisplayValue;
  }, '');

export const getMovementTotalReps = (
  repScheme: number[],
  completedRounds: number,
) => repScheme.reduce((sum, r) => sum + r, 0) * completedRounds;

export const getMovementVolume = (
  movement: Pick<MovementLog, 'repScheme' | 'weightOneValue' | 'weightTwoValue'>,
  completedRounds: number,
): number | null => {
  if (movement.weightOneValue === null && movement.weightTwoValue === null) {
    return null;
  }
  const weightPerRep =
    (movement.weightOneValue ?? 0) + (movement.weightTwoValue ?? 0);
  const totalReps = getMovementTotalReps(movement.repScheme, completedRounds);
  return weightPerRep * totalReps;
};

export const getCompactRepScheme = (
  repScheme: number[],
  completedRounds: number,
): string => {
  if (repScheme.every((r) => r === repScheme[0])) {
    const rep = repScheme[0];
    return `${rep} ${rep === 1 ? 'rep' : 'reps'} × ${
      completedRounds * repScheme.length
    }`;
  }
  return `${repScheme.join(', ')} reps × ${completedRounds}`;
};

export const formatMovementWeightLine = (
  movement: Pick<
    MovementLog,
    'weightOneValue' | 'weightOneUnit' | 'weightTwoValue' | 'weightTwoUnit'
  >,
): string | null => {
  if (movement.weightOneValue === null && movement.weightTwoValue === null) {
    return null;
  }
  const unit = getWeightUnitLabel(movement.weightOneUnit);
  if (movement.weightTwoValue != null && movement.weightTwoValue > 0) {
    return `${movement.weightOneValue} + ${movement.weightTwoValue} ${unit}`;
  }
  return `${movement.weightOneValue} ${unit}`;
};

export const formatCarriedWeights = (
  weightOneValue: number | null,
  weightOneUnit: WeightUnit | null,
  weightTwoValue: number | null,
  weightTwoUnit: WeightUnit | null,
): string => {
  const parts: string[] = [];
  if (weightOneValue != null) {
    parts.push(`${weightOneValue} ${getWeightUnitLabel(weightOneUnit)}`);
  }
  if (weightTwoValue != null && weightTwoValue > 0) {
    parts.push(`${weightTwoValue} ${getWeightUnitLabel(weightTwoUnit)}`);
  }
  return parts.join(' + ');
};

export const formatTimerSeconds = (seconds: number) => `${seconds}s`;

export const getGoalPillLabel = (workoutGoal: number, workoutGoalUnits: string) => {
  switch (workoutGoalUnits) {
    case 'minutes':
      return `${workoutGoal}M GOAL`;
    case 'rounds':
      return workoutGoal === 1
        ? `${workoutGoal} ROUND GOAL`
        : `${workoutGoal} ROUNDS GOAL`;
    case 'reps':
      return workoutGoal === 1
        ? `${workoutGoal} REP GOAL`
        : `${workoutGoal} REPS GOAL`;
    case 'kilograms':
      return `${workoutGoal}KG GOAL`;
    case 'rungs':
      return workoutGoal === 1
        ? `${workoutGoal} RUNG GOAL`
        : `${workoutGoal} RUNGS GOAL`;
    default:
      return `${workoutGoal} ${workoutGoalUnits.toUpperCase()} GOAL`;
  }
};
