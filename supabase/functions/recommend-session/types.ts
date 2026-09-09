// recommend-session (PROD-87): shared types + the structured-output JSON schema.
//
// RecommenderInputs is the typed snapshot fed to the LLM and persisted verbatim
// into session_recommendations.inputs. unlocked_weights carries the weights the
// user can actually load, derived from their declared equipment (PROD-78); it
// stays `{}` for users who have recorded none.
import type { EquipmentSummary } from '../../../src/utils/equipment.ts';
import type {
  Modality,
  OverallModalityBalance,
} from '../../../src/utils/modalityDebt.ts';
import type {
  DebtBand,
  OverallBalance,
  Pattern,
  PatternRpe,
} from '../../../src/utils/patternDebt.ts';
import type { SkillTreeSummary } from '../../../src/utils/skillTreeProgress.ts';

/**
 * One movement from the catalog, kettlebell or bodyweight — the candidate set
 * the LLM may choose from. Custom (unlinked) library movements are never
 * candidates.
 */
export interface CandidateMovement {
  /** `movements.id` in the catalog. */
  movement_id: string;
  name: string;
  /** Coarse patterns this movement pays credit toward; null when it credits none. */
  pattern_credits: Pattern[] | null;
  /** Takes no bell: prescribed with weight_kg 0 and bells 0. */
  bodyweight: boolean;
  supports_doubles: boolean;
  unilateral_lower: boolean;
  /** Skill-tree node this movement practises; null means it is never gated. */
  skill_node_id: string | null;
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

/**
 * One modality's scored balance, serialized like {@link PatternDebtEntry}. The
 * second balance axis (src/utils/modalityDebt.ts): what a rep *is* — grind,
 * ballistic, conditioning, mobility — rather than which pattern it trains.
 */
export interface ModalityDebtEntry {
  modality: Modality;
  days_since_last_trained: number | null;
  recent_volume_kg: number;
  baseline_volume_kg: number | null;
  debt_score: number;
  band: DebtBand;
  hardest_rpe: PatternRpe | null;
  /** Never trained in the baseline window — treat as neutral, not overdue. */
  is_new: boolean;
}

export interface ModalityDebtInput {
  overall_balance: OverallModalityBalance;
  modalities: ModalityDebtEntry[];
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
  /**
   * The modality axis, scored from the same RPC rows as pattern_debt and null
   * on the same failure. A soft signal only: unlike balance_targets it creates
   * no coverage requirement and no validation retry.
   */
  modality_debt: ModalityDebtInput | null;
  /** `{}` when the user has recorded no equipment — the prompt then omits the section. */
  unlocked_weights: EquipmentSummary | Record<string, never>;
  /**
   * The lifter's position on the skill tree. Null when they have no progress
   * rows or the fetch failed: no prompt section and no ceiling. When present,
   * `candidates` has already been trimmed to the nodes within their reach.
   */
  skill_tree: SkillTreeSummary | null;
}

/** One block of the recommended session. Maps onto the app's MovementOptions. */
export interface RecommendationBlock {
  /** The catalog `movements.id` the block was chosen from. */
  movement_id: string;
  movement_name: string;
  /** Weight of ONE bell; 0 for a bodyweight movement. */
  weight_kg: number;
  rep_scheme: number[];
  notes: string;
  /**
   * Kettlebells held at once for this block: 1, 2 for genuine double-bell
   * work, or 0 for bodyweight. Optional here only so recommendations persisted
   * before this field existed still parse; the schema requires it for new output.
   */
  bells?: number;
}

/** The validated LLM output. Persisted into session_recommendations.output. */
export interface Recommendation {
  rationale: string;
  duration_minutes: number;
  /** Always a circuit: the lifter rotates through the blocks one rung at a time. */
  format: 'Circuit';
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
    format: { type: 'string', enum: ['Circuit'] },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    adjustable_settings_kg: { type: 'array', items: { type: 'number' } },
    blocks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          movement_id: { type: 'string' },
          movement_name: { type: 'string' },
          weight_kg: { type: 'number' },
          bells: { type: 'integer' },
          rep_scheme: { type: 'array', items: { type: 'integer' } },
          notes: { type: 'string' },
        },
        required: [
          'movement_id',
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
