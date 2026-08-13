// recommend-session (PROD-87): shared types + the structured-output JSON schema.
//
// RecommenderInputs is the typed snapshot fed to the LLM and persisted verbatim
// into session_recommendations.inputs. unlocked_weights carries the weights the
// user can actually load, derived from their declared equipment (PROD-78); it
// stays `{}` for users who have recorded none.

import type { EquipmentSummary } from '../../../src/utils/equipment.ts';
import type {
  DebtBand,
  OverallBalance,
  Pattern,
  PatternRpe,
} from '../../../src/utils/patternDebt.ts';

/** One movement in the user's library — the candidate set the LLM may choose from. */
export interface CandidateMovement {
  user_movement_id: string;
  name: string;
  is_big_6: boolean;
  /** Coarse patterns this movement pays credit toward; null when unlinked with no fallback. */
  pattern_credits: Pattern[] | null;
  /**
   * Whether the catalog says this movement is done with two bells. Null when the
   * movement is unlinked and we simply do not know — never enforced in that case.
   */
  supports_doubles: boolean | null;
}

/** A compact summary of one past workout, for history context. */
export interface WorkoutHistoryEntry {
  completed_at: string;
  goal: string; // e.g. "20 minutes", "5 rounds", "1000 kg"
  rpe: string | null;
  movements: Array<{
    name: string;
    rep_scheme: number[];
    weight_kg: number | null;
  }>;
}

/**
 * One pattern's scored debt, serialized (dates as ISO strings) for the inputs
 * JSONB snapshot and the prompt. Derived from the shared scoring model
 * (src/utils/patternDebt.ts, PROD-155).
 */
export interface PatternDebtEntry {
  pattern: Pattern;
  days_since_last_trained: number | null;
  recent_volume_kg: number;
  baseline_volume_kg: number | null;
  debt_score: number;
  band: DebtBand;
  hardest_rpe: PatternRpe | null;
  /** Never trained in the baseline window — treat as neutral, not overdue. */
  is_new: boolean;
}

export interface PatternDebtInput {
  overall_balance: OverallBalance;
  patterns: PatternDebtEntry[];
}

/** Everything the recommender reasons over. Snapshotted into inputs JSONB. */
export interface RecommenderInputs {
  /**
   * Deterministic must-cover targets: the highest-debt red-band patterns
   * coverable from the candidate set (max BALANCE_TARGET_LIMIT). [] when
   * pattern debt is unavailable or nothing red is coverable.
   */
  balance_targets: Pattern[];
  training_goal: string | null;
  readiness: string | null;
  days_since_last_workout: number | null;
  recent_history: WorkoutHistoryEntry[];
  candidates: CandidateMovement[];
  /** Null when the pattern_debt_movements RPC fails — never blocks a recommendation. */
  pattern_debt: PatternDebtInput | null;
  /** `{}` when the user has recorded no equipment — the prompt then omits the section. */
  unlocked_weights: EquipmentSummary | Record<string, never>;
}

/** One block of the recommended session. Maps onto the app's MovementOptions. */
export interface RecommendationBlock {
  user_movement_id: string;
  movement_name: string;
  weight_kg: number;
  rep_scheme: number[];
  notes: string;
  /**
   * Kettlebells held at once for this block: 1, or 2 for genuine double-bell
   * work. Optional here only so recommendations persisted before this field
   * existed still parse; the schema requires it for new output.
   */
  bells?: number;
}

/** The validated LLM output. Persisted into session_recommendations.output. */
export interface Recommendation {
  rationale: string;
  duration_minutes: number;
  format: 'EMOM' | 'AMRAP' | 'Circuit' | 'Ladder' | 'Straight Sets';
  confidence: 'high' | 'medium' | 'low';
  blocks: RecommendationBlock[];
  /**
   * The weight each adjustable bell is set to before the session starts, one
   * entry per bell used. Optional here only so recommendations persisted before
   * this field existed still parse; the schema requires it for new output.
   */
  adjustable_settings_kg?: number[];
}

// JSON schema for Anthropic structured outputs (output_config.format). Structured
// outputs forbid numeric min/max and string length constraints and require every
// object to set additionalProperties:false with all properties in `required` — so
// value-range sanity (positive weights/reps, ids in the candidate set) is enforced
// separately in validate.ts, not here.
export const RECOMMENDATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    rationale: { type: 'string' },
    duration_minutes: { type: 'integer' },
    format: {
      type: 'string',
      enum: ['EMOM', 'AMRAP', 'Circuit', 'Ladder', 'Straight Sets'],
    },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    adjustable_settings_kg: { type: 'array', items: { type: 'number' } },
    blocks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          user_movement_id: { type: 'string' },
          movement_name: { type: 'string' },
          weight_kg: { type: 'number' },
          bells: { type: 'integer' },
          rep_scheme: { type: 'array', items: { type: 'integer' } },
          notes: { type: 'string' },
        },
        required: [
          'user_movement_id',
          'movement_name',
          'weight_kg',
          'bells',
          'rep_scheme',
          'notes',
        ],
      },
    },
  },
  required: [
    'rationale',
    'duration_minutes',
    'format',
    'confidence',
    'adjustable_settings_kg',
    'blocks',
  ],
} as const;
