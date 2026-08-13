import { WeightUnit } from './weight-unit.type';

export interface MovementLog {
  id: number;
  movementName: string;
  /** Reps per rung, or seconds per rung when `timedRungs` is set. */
  repScheme: number[];
  timedRungs?: boolean;
  /**
   * What was actually done, one entry per completed set in order — reps, or
   * seconds when `timedRungs` is set. Spans every round and side, so it is not
   * index-aligned with `repScheme`.
   */
  completedRepScheme?: number[];
  userMovementId: string | null;
  functionalMovementId: string | null;
  weightOneUnit: WeightUnit | null;
  weightOneValue: number | null;
  weightTwoUnit: WeightUnit | null;
  weightTwoValue: number | null;
}
