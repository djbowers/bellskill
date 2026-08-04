import { RpeOptions } from './rpe-options.type';
import { WeightUnit } from './weight-unit.type';
import { WorkoutGoalUnits } from './workout-goal-units.type';
import { WorkoutMode } from './workout-mode.type';

export interface WorkoutLog {
  completedAt: Date;
  completedReps: number;
  completedRounds: number;
  completedRungs: number;
  completedSides: number | null;
  completedVolume: number | null;
  id: number;
  intervalTimer: number;
  movements: string[];
  restTimer: number;
  rpe: RpeOptions | null;
  sharedWeightOneUnit: WeightUnit | null;
  sharedWeightOneValue: number | null;
  sharedWeightTwoUnit: WeightUnit | null;
  sharedWeightTwoValue: number | null;
  startedAt: Date;
  workoutMode: WorkoutMode;
  title: string | null;
  preWorkoutNotes: string | null;
  workoutGoal: number;
  workoutGoalUnits: WorkoutGoalUnits;
  postWorkoutNotes: string | null;
}
