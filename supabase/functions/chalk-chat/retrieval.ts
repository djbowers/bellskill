// chalk-chat: hybrid retrieval for Chalk RAG (PROD-248).
//
// Two scopes over one pipeline: the coaching knowledge corpus and the lifter's
// own embedded workout history (chunks written by chalk-embed-history). Both
// embed the question in-process (same gte-small model that embedded the
// corpus — see _shared/embeddings.ts) and call the chalk_hybrid_search SQL
// function, which fuses pgvector cosine ranking with Postgres FTS via RRF.
//
// Best-effort by contract: any failure returns an empty result so a chat turn
// is never blocked on retrieval — Chalk degrades to its pre-RAG behavior.
// Retrieved content is text headed for the prompt, so it gets the same
// sanitation as every other prompt input, and the prompt's data-not-
// instructions rules cover both blocks.

import type { SupabaseClient } from '@supabase/supabase-js';

import { embedText } from '../_shared/embeddings.ts';
import type { RetrievedChunk, RetrievalResult } from './types.ts';

export const KNOWLEDGE_MATCH_COUNT = 4;
export const HISTORY_MATCH_COUNT = 3;

/** Total budget for retrieved text in the prompt. Knowledge chunks are ~1200
 *  chars, so this admits ~3-4 full chunks; lowest-RRF chunks are dropped past
 *  it. History chunks are smaller (one workout's notes). */
export const KNOWLEDGE_CHAR_BUDGET = 4800;
export const HISTORY_CHAR_BUDGET = 2400;

/** Below ~8 words, questions like "how heavy?" carry no retrievable nouns;
 *  prefixing the training goal gives the embedding something to grip. */
const SHORT_QUERY_WORDS = 8;

const MAX_CHUNK_CHARS = 1600;

/** Same rule as inputs.ts sanitize(): retrieved text lands in a
 *  system-adjacent block, so strip control characters that could fake a
 *  delimiter. */
function sanitizeChunk(value: string): string {
  return (
    value
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_CHUNK_CHARS)
  );
}

export function buildRetrievalQuery(
  message: string,
  trainingGoal: string | null,
): string {
  const words = message.trim().split(/\s+/).filter(Boolean);
  if (trainingGoal && words.length < SHORT_QUERY_WORDS) {
    return `${trainingGoal}: ${message.trim()}`;
  }
  return message.trim();
}

interface HybridSearchRow {
  id: string;
  content: string;
  metadata: Record<string, unknown> | null;
  source_id: string | null;
  rrf_score: number;
}

/** Short queries only: one indexed row read, so retrieval can run fully
 *  concurrent with gatherContext instead of waiting on its profile fetch. */
async function fetchTrainingGoal(
  admin: SupabaseClient,
  userId: string,
): Promise<string | null> {
  try {
    const { data } = await admin
      .from('profiles')
      .select('training_goal')
      .eq('id', userId)
      .single();
    return data?.training_goal ?? null;
  } catch {
    return null;
  }
}

async function retrieve(
  admin: SupabaseClient,
  userId: string,
  message: string,
  scope: 'knowledge' | 'user_history',
): Promise<RetrievalResult> {
  const startedAt = Date.now();
  const isShort =
    message.trim().split(/\s+/).filter(Boolean).length < SHORT_QUERY_WORDS;
  const trainingGoal =
    isShort && scope === 'knowledge'
      ? await fetchTrainingGoal(admin, userId)
      : null;
  const query = buildRetrievalQuery(message, trainingGoal);

  const matchCount =
    scope === 'knowledge' ? KNOWLEDGE_MATCH_COUNT : HISTORY_MATCH_COUNT;
  const charBudget =
    scope === 'knowledge' ? KNOWLEDGE_CHAR_BUDGET : HISTORY_CHAR_BUDGET;

  try {
    const queryEmbedding = await embedText(query);

    // Generated DB types don't know this function — cast at the RPC boundary
    // only, same as pattern_debt_movements in inputs.ts.
    const { data, error } = await admin.rpc('chalk_hybrid_search' as never, {
      query_embedding: JSON.stringify(queryEmbedding),
      query_text: query,
      match_scope: scope,
      match_user_id: scope === 'user_history' ? userId : null,
      match_count: matchCount,
    } as never);
    if (error) throw error;

    const chunks: RetrievedChunk[] = [];
    let budget = charBudget;
    for (const row of (data ?? []) as HybridSearchRow[]) {
      const content = sanitizeChunk(row.content);
      if (!content || content.length > budget) continue;
      budget -= content.length;
      chunks.push({
        id: row.id,
        title:
          typeof row.metadata?.title === 'string'
            ? sanitizeChunk(row.metadata.title)
            : null,
        source_id: row.source_id ?? null,
        content,
        rrf_score: row.rrf_score,
      });
    }

    return {
      query,
      chunks,
      chunk_ids: chunks.map((c) => c.id),
      scores: chunks.map((c) => c.rrf_score),
      latency_ms: Date.now() - startedAt,
      error: null,
    };
  } catch (err) {
    console.error(`chalk-chat ${scope} retrieval failed:`, err);
    return {
      query,
      chunks: [],
      chunk_ids: [],
      scores: [],
      latency_ms: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function retrieveKnowledge(
  admin: SupabaseClient,
  userId: string,
  message: string,
): Promise<RetrievalResult> {
  return retrieve(admin, userId, message, 'knowledge');
}

/** The lifter's embedded workout history — sessions beyond the structured
 *  recent-history window. Caller dedupes against the workouts already in the
 *  context block (by source_id) before rendering. */
export function retrieveHistory(
  admin: SupabaseClient,
  userId: string,
  message: string,
): Promise<RetrievalResult> {
  return retrieve(admin, userId, message, 'user_history');
}
