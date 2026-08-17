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
  /**
   * Lunges, split squats, single-leg hinges: every rung runs once per leg.
   * Seeded from the catalog and overridable. Distinct from the one-hand
   * sentinel (`weightTwoValue === 0`) — either one mirrors a rung, and a
   * double-bell single-leg RDL is unilateral without being one-handed.
   */
  unilateral?: boolean;
  weightOneUnit: WeightUnit | null;
  weightOneValue: number | null;
  weightTwoUnit: WeightUnit | null;
  weightTwoValue: number | null;
}
