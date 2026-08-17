import { DifficultyLevel } from './difficultyLevel.type';
import { Equipment } from './equipment.type';
import { MuscleGroup } from './muscle-group.type';

// The slim catalog (PROD-153) keeps only the fields the app consumes. All the
// controlled fields are now free-text columns; the unions above mirror the
// authored value set (scripts/data/movements.csv). `movementPattern1` stays a
// broad string — the recommender's pattern-debt CASE is the authority on which
// values are meaningful, and it is validated separately.
export interface Movement {
  id: string;
  movementName: string | null;
  primaryEquipment: Equipment | null;
  primaryItemCount: number | null;
  singleOrDoubleArm: 'Single Arm' | 'Double Arm' | 'No Arms' | null;
  targetMuscleGroup: MuscleGroup | null;
  difficultyLevel: DifficultyLevel | null;
  movementPattern1: string | null;
  patternCredits: string[];
  /** One leg at a time — independent of how many bells are held up top. */
  unilateralLower: boolean;
}
