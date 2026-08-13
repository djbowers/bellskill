import { WeightUnit } from './weight-unit.type';

export interface MovementOptions {
  movementName: string;
  /**
   * Reps per rung, or seconds per rung when `timedRungs` is set. Under
   * `maxReps` only the length matters — one rung per set, values unused.
   */
  repScheme: number[];
  /** Carries, planks, marches: each rung runs on a countdown instead of reps. */
  timedRungs?: boolean;
  /** Sets to failure: the runner asks for the count instead of prescribing one. */
  maxReps?: boolean;
  weightOneUnit: WeightUnit | null;
  weightOneValue: number | null;
  weightTwoUnit: WeightUnit | null;
  weightTwoValue: number | null;
}
