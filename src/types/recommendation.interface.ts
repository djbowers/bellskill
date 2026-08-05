// AI Next Session Recommender (PROD-89): client-side types for the
// recommend-session Edge Function response. These mirror the function's JSON
// wire shape (snake_case), so the response is consumed without remapping; the
// app-facing conversion to MovementOptions lives in recommendationToMovements.

export type RecommendationFormat =
  | 'EMOM'
  | 'AMRAP'
  | 'Circuit'
  | 'Ladder'
  | 'Straight Sets';

export type RecommendationConfidence = 'high' | 'medium' | 'low';

export interface RecommendationBlock {
  user_movement_id: string;
  movement_name: string;
  weight_kg: number;
  rep_scheme: number[];
  notes: string;
  /** Bells held at once (1, or 2 for double-bell). Absent on older recommendations. */
  bells?: number;
}

export interface Recommendation {
  rationale: string;
  duration_minutes: number;
  format: RecommendationFormat;
  confidence: RecommendationConfidence;
  blocks: RecommendationBlock[];
  /** Weight each adjustable bell is set to for the session. Absent on older recommendations. */
  adjustable_settings_kg?: number[];
}

/** Success payload from `recommend-session`. */
export interface RecommendSessionResponse {
  id: string;
  recommendation: Recommendation;
}

/** Whether the recommended program starts now or waits for a free slot. */
export type ProgramRecommendationMode = 'concurrent' | 'queue';

/** Validated output of the `recommend-program` Edge Function. */
export interface ProgramRecommendation {
  program_id: string;
  mode: ProgramRecommendationMode;
  rationale: string;
  confidence: RecommendationConfidence;
}

/** Success payload from `recommend-program`. */
export interface RecommendProgramResponse {
  id: string;
  recommendation: ProgramRecommendation;
}
