// chalk-chat: hybrid retrieval over the Chalk knowledge corpus (PROD-248).
//
// Embeds the lifter's question in-process (same gte-small model that embedded
// the corpus — see _shared/embeddings.ts) and calls the chalk_hybrid_search
// SQL function, which fuses pgvector cosine ranking with Postgres FTS via RRF.
//
// Best-effort by contract: any failure here returns an empty result so a chat
// turn is never blocked on retrieval — Chalk degrades to its pre-RAG behavior.
// Retrieved content is corpus text headed for the prompt, so it gets the same
// sanitation as every other prompt input, and the prompt's data-not-
// instructions rule covers it (see COACHING_REFERENCE handling in prompt.ts).

import type { SupabaseClient } from '@supabase/supabase-js';

import { embedText } from '../_shared/embeddings.ts';
import type { RetrievedChunk, RetrievalResult } from './types.ts';

export const KNOWLEDGE_MATCH_COUNT = 4;

/** Total budget for retrieved text in the prompt. Chunks are ~1200 chars, so
 *  this admits ~3-4 full chunks; lowest-RRF chunks are dropped past it. */
export const KNOWLEDGE_CHAR_BUDGET = 4800;

/** Below ~8 words, questions like "how heavy?" carry no retrievable nouns;
 *  prefixing the training goal gives the embedding something to grip. */
const SHORT_QUERY_WORDS = 8;

const MAX_CHUNK_CHARS = 1600;

/** Same rule as inputs.ts sanitize(): corpus text lands in a system-adjacent
 *  block, so strip control characters that could fake a delimiter. */
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

export async function retrieveKnowledge(
  admin: SupabaseClient,
  userId: string,
  message: string,
): Promise<RetrievalResult> {
  const startedAt = Date.now();
  const isShort =
    message.trim().split(/\s+/).filter(Boolean).length < SHORT_QUERY_WORDS;
  const trainingGoal = isShort ? await fetchTrainingGoal(admin, userId) : null;
  const query = buildRetrievalQuery(message, trainingGoal);

  try {
    const queryEmbedding = await embedText(query);

    // Generated DB types don't know this function — cast at the RPC boundary
    // only, same as pattern_debt_movements in inputs.ts.
    const { data, error } = await admin.rpc('chalk_hybrid_search' as never, {
      query_embedding: JSON.stringify(queryEmbedding),
      query_text: query,
      match_scope: 'knowledge',
      match_count: KNOWLEDGE_MATCH_COUNT,
    } as never);
    if (error) throw error;

    const chunks: RetrievedChunk[] = [];
    let budget = KNOWLEDGE_CHAR_BUDGET;
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
    console.error('chalk-chat retrieval failed:', err);
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
