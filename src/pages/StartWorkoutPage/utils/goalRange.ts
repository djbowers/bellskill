import { ValueRange, WorkoutGoalUnits } from '~/types';

export const INCREMENT_VOLUME = 10; // kg

export const getGoalRange = (units: WorkoutGoalUnits): ValueRange => {
  if (units === 'kilograms')
    return { min: 100, max: 3000, step: INCREMENT_VOLUME };
  if (units === 'rounds') return { min: 1, max: 100, step: 1 };
  return { min: 1, max: 120, step: 1 };
};
