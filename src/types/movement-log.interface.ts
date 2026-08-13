import { WeightUnit } from './weight-unit.type';

export interface MovementLog {
  id: number;
  movementName: string;
  /** Reps per rung, or seconds per rung when `timedRungs` is set. */
  repScheme: number[];
  timedRungs?: boolean;
  maxReps?: boolean;
  /** Reps actually completed, one entry per set in completion order. */
  completedRepScheme?: number[];
  userMovementId: string | null;
  functionalMovementId: string | null;
  weightOneUnit: WeightUnit | null;
  weightOneValue: number | null;
  weightTwoUnit: WeightUnit | null;
  weightTwoValue: number | null;
}
