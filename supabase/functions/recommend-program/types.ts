// recommend-program: shared types + the structured-output JSON schema.
//
// RecommenderInputs is the typed snapshot fed to the LLM and persisted verbatim
// into program_recommendations.inputs.

import type { EquipmentSummary } from '../../../src/utils/equipment.ts';
import type {
  DebtBand,
  Modality,
  OverallBalance,
  OverallModalityBalance,
  Pattern,
  PatternRpe,
  StackFit,
} from './scoring.ts';

/**
 * One pattern's scored debt, serialized (dates as ISO strings) for the inputs
 * JSONB snapshot and the prompt. Derived from the shared scoring model
 * (src/utils/patternDebt.ts, PROD-155).
 */
export interface PatternDebtEntry {
  pattern: Pattern;
  days_since_last_trained: number | null;
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

/** One modality's scored balance — how the lifter has been moving. */
export interface ModalityDebtEntry {
  modality: Modality;
  days_since_last_trained: number | null;
  recent_volume_kg: number;
  baseline_volume_kg: number | null;
  debt_score: number;
  band: DebtBand;
  is_new: boolean;
}

export interface ModalityDebtInput {
  overall_balance: OverallModalityBalance;
  modalities: ModalityDebtEntry[];
}

/** One program the user is currently running. */
export interface ActiveProgramSummary {
  program_id: string;
  title: string;
  focus_tags: string[];
  /**
   * The modalities this program's prescribed movements actually train, derived
   * (src/utils/programModality.ts) rather than authored. A different axis from
   * focus_tags — what a rep is, not what the prescription buys — and empty when
   * no prescribed movement matched the catalog.
   */
  modality_profile: string[];
  systemic_demand: string | null;
  /** Sessions satisfied / total, e.g. "4/12". */
  progress: string;
  last_worked_at: string | null;
}

/** One program waiting in the queue. */
export interface QueuedProgramSummary {
  program_id: string;
  title: string;
}

/** One shared-catalog program the LLM may recommend. */
export interface CandidateProgram {
  program_id: string;
  title: string;
  description: string | null;
  focus_tags: string[];
  /** See {@link ActiveProgramSummary.modality_profile}. */
  modality_profile: string[];
  systemic_demand: string | null;
  session_count: number;
  /** Precomputed vs the active stack; null when there is nothing to assess. */
  stack_fit: StackFit | null;
}

/** A compact summary of one past workout, for history context. */
export interface WorkoutSummary {
  completed_at: string;
  goal: string;
  rpe: string | null;
  movements: string[];
}

/** Everything the recommender reasons over. Snapshotted into inputs JSONB. */
export interface RecommenderInputs {
  training_goal: string | null;
  days_since_last_workout: number | null;
  slots_available: number;
  active_programs: ActiveProgramSummary[];
  queued_programs: QueuedProgramSummary[];
  candidates: CandidateProgram[];
  pattern_debt: PatternDebtInput;
  /**
   * The modality axis, scored from the same RPC rows as pattern_debt. Null when
   * the catalog credits nothing the lifter has trained — the prompt then omits
   * the section rather than claiming an even mix.
   */
  modality_debt: ModalityDebtInput | null;
  recent_history: WorkoutSummary[];
  /** Null when the user has recorded no equipment — the prompt then omits the section. */
  equipment: EquipmentSummary | null;
}

/** The validated LLM output. Persisted into program_recommendations.output. */
export interface ProgramRecommendation {
  program_id: string;
  mode: 'concurrent' | 'queue';
  rationale: string;
  confidence: 'high' | 'medium' | 'low';
}

// JSON schema for Anthropic structured outputs (output_config.format).
// Structured outputs require additionalProperties:false with every property
// required — id/mode feasibility is enforced separately in validate.ts.
export const RECOMMENDATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    program_id: { type: 'string' },
    mode: { type: 'string', enum: ['concurrent', 'queue'] },
    rationale: { type: 'string' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: ['program_id', 'mode', 'rationale', 'confidence'],
} as const;
