import { ValueRange, WorkoutGoalUnits } from '~/types';

export const INCREMENT_VOLUME = 10; // kg

export const getGoalRange = (units: WorkoutGoalUnits): ValueRange => {
  // The minus button floors volume at 1kg, below the step grid; the strip shows
  // the grid and leaves that last value to the button.
  if (units === 'kilograms')
    return { min: INCREMENT_VOLUME, max: 3000, step: INCREMENT_VOLUME };
  if (units === 'rounds') return { min: 1, max: 100, step: 1 };
  return { min: 1, max: 120, step: 1 };
};
