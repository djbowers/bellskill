// chalk-chat: the shapes shared between input assembly, prompt building, and
// the provider boundary. Chalk is read-only, so unlike the recommenders there is
// no structured output schema — the model returns prose.

import type { ModalityDebtLineEntry } from '../_shared/modalityPrompt.ts';
import type { PatternDebtLineEntry } from '../_shared/patternDebtPrompt.ts';
import type { EquipmentSummary } from '../../../src/utils/equipment.ts';

/** One logged workout, flattened for the prompt. */
export interface WorkoutHistoryEntry {
  completed_at: string;
  goal: string;
  rpe: string | null;
  /** Free text the lifter wrote before/after the session. User-authored. */
  pre_notes: string | null;
  post_notes: string | null;
  movements: Array<{
    name: string;
    rep_scheme: number[];
    weight_kg: number | null;
  }>;
}

export interface PatternDebtInput {
  overall_balance: number;
  patterns: PatternDebtLineEntry[];
}

/** The second balance axis: how the lifter has been moving, not which patterns. */
export interface ModalityDebtInput {
  overall_balance: string;
  modalities: ModalityDebtLineEntry[];
}

/** A movement in the lifter's own library. */
export interface LibraryMovement {
  name: string;
  is_big_6: boolean;
  pattern_credits: string[] | null;
}

export interface EnrolledProgram {
  title: string;
  status: 'active' | 'queued';
  focus_tags: string[];
}

export interface CatalogProgram {
  title: string;
  focus_tags: string[];
}

/** Everything Chalk knows about the lifter for one turn. */
export interface ChalkContext {
  training_goal: string | null;
  days_since_last_workout: number | null;
  recent_history: WorkoutHistoryEntry[];
  /** One aggregate line covering the last 12 months, so "am I training more
   *  than last year" is answerable without pulling a year of rows. */
  long_range: {
    sessions_12mo: number;
    sessions_per_week: number;
    top_movements: Array<{ name: string; set_count: number }>;
  } | null;
  pattern_debt: PatternDebtInput | null;
  /** Scored from the same RPC rows as pattern_debt; null on the same failure. */
  modality_debt: ModalityDebtInput | null;
  library: LibraryMovement[];
  enrolled_programs: EnrolledProgram[];
  catalog_programs: CatalogProgram[];
  equipment: EquipmentSummary | null;
}

/** A prior turn, replayed to the model. Always server-authored. */
export interface ChalkTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** One corpus chunk surfaced by chalk_hybrid_search, sanitized for the prompt. */
export interface RetrievedChunk {
  id: string;
  title: string | null;
  content: string;
  rrf_score: number;
}

/**
 * The full retrieval outcome for one turn. Persisted (minus chunk text) into
 * the assistant row's context snapshot so the eval harness can replay exactly
 * what the model saw. Best-effort: `error` set and `chunks` empty on failure.
 */
export interface RetrievalResult {
  query: string;
  chunks: RetrievedChunk[];
  chunk_ids: string[];
  scores: number[];
  latency_ms: number;
  error: string | null;
}
