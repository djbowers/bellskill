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
}

export interface Recommendation {
  rationale: string;
  duration_minutes: number;
  format: RecommendationFormat;
  confidence: RecommendationConfidence;
  blocks: RecommendationBlock[];
}

/** Success payload from `recommend-session`. */
export interface RecommendSessionResponse {
  id: string;
  recommendation: Recommendation;
}
