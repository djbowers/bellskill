import { createContext, useContext, useState } from 'react';

import { MovementOptions, WorkoutOptions } from '~/types';

export const DEFAULT_MOVEMENT_OPTIONS: MovementOptions = {
  movementName: '',
  repScheme: [5],
  weightOneUnit: 'kilograms',
  weightOneValue: 16,
  weightTwoUnit: null,
  weightTwoValue: null,
};

export const DEFAULT_WORKOUT_OPTIONS: WorkoutOptions = {
  complexSet: false,
  intervalTimer: 0,
  movements: [{ ...DEFAULT_MOVEMENT_OPTIONS }],
  restTimer: 0,
  sharedWeightOneUnit: DEFAULT_MOVEMENT_OPTIONS.weightOneUnit,
  sharedWeightOneValue: DEFAULT_MOVEMENT_OPTIONS.weightOneValue,
  sharedWeightTwoUnit: null,
  sharedWeightTwoValue: null,
  workoutDetails: null,
  workoutGoal: 10,
  workoutGoalUnits: 'minutes',
  previousVolume: 1000,
  previousMinutes: 10,
  previousRounds: 10,
};

export const WorkoutOptionsContext = createContext<
  [WorkoutOptions, (workoutOptions: WorkoutOptions) => void]
>(undefined!);

export const WorkoutOptionsProvider = ({ ...props }) => {
  const [workoutOptions, setWorkoutOptions] = useState<WorkoutOptions>(
    DEFAULT_WORKOUT_OPTIONS,
  );

  return (
    <WorkoutOptionsContext.Provider
      value={[workoutOptions, setWorkoutOptions]}
      {...props}
    />
  );
};

export const useWorkoutOptions = () => useContext(WorkoutOptionsContext);
