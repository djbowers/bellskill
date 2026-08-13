import { WeightUnit } from './weight-unit.type';

export interface MovementOptions {
  movementName: string;
  /**
   * Reps per rung, or seconds per rung when `timedRungs` is set. A rung of 0
   * means "to failure" — see {@link isMaxRung}.
   */
  repScheme: number[];
  /** Carries, planks, marches: each rung runs on a countdown instead of reps. */
  timedRungs?: boolean;
  weightOneUnit: WeightUnit | null;
  weightOneValue: number | null;
  weightTwoUnit: WeightUnit | null;
  weightTwoValue: number | null;
}
