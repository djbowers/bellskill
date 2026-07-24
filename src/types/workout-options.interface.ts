import { MovementOptions } from './movement-options.interface';
import { WeightUnit } from './weight-unit.type';
import { WorkoutGoalUnits } from './workout-goal-units.type';

export interface WorkoutOptions {
  complexSet: boolean;
  intervalTimer: number; // seconds
  movements: MovementOptions[];
  // Traversal order: when true, every rung of a movement is completed before the
  // next movement starts. Absent/false rotates through the movements each rung.
  straightSets?: boolean;
  restTimer: number; // seconds
  sharedWeightOneUnit: WeightUnit | null;
  sharedWeightOneValue: number | null;
  sharedWeightTwoUnit: WeightUnit | null;
  sharedWeightTwoValue: number | null;
  startedAt?: Date;
  title: string | null;
  preWorkoutNotes: string | null;
  workoutGoal: number; // minutes, rounds, or target volume (kg)
  workoutGoalUnits: WorkoutGoalUnits;
  previousVolume?: number; // previous completed volume (kg) for volume goal calculations
  previousMinutes?: number; // actual completed duration in minutes from repeated workout
  previousRounds?: number; // actual completed rounds from repeated workout
}
