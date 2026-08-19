-- Chalk RAG (PROD-248): hybrid retrieval over chalk_chunks.
--
-- Fuses two rankings with Reciprocal Rank Fusion (score = Σ 1/(rrf_k + rank)):
--   dense   — pgvector cosine distance over the gte-small embeddings
--   lexical — Postgres FTS (websearch_to_tsquery / ts_rank_cd)
-- RRF needs no score normalization across the two retrievers, which is the
-- whole reason to use it over a weighted sum of incomparable scores.
--
-- SECURITY DEFINER, and EXECUTE is revoked from every client role: only the
-- service role (Edge Functions) may call this. Unlike pattern_debt_movements
-- (SECURITY INVOKER on auth.uid()), row scoping here is the caller's job —
-- chalk-chat passes the JWT-derived user id as match_user_id, the same
-- "ownership check in the function IS the boundary" contract as resolveThread.

CREATE OR REPLACE FUNCTION chalk_hybrid_search(
  query_embedding extensions.vector(384),
  query_text TEXT,
  match_scope TEXT,
  match_user_id UUID DEFAULT NULL,
  match_count INTEGER DEFAULT 6,
  rrf_k INTEGER DEFAULT 50,
  -- 'hybrid' in production; 'dense'/'lexical' exist for the eval harness's
  -- ablations (scripts/eval/), so the hybrid-vs-single-retriever delta is a
  -- measured number rather than a claim.
  search_mode TEXT DEFAULT 'hybrid'
) RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  document_id UUID,
  source_table TEXT,
  source_id TEXT,
  rrf_score DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF match_scope NOT IN ('knowledge', 'user_history') THEN
    RAISE EXCEPTION 'chalk_hybrid_search: unknown scope %', match_scope;
  END IF;
  IF match_scope = 'user_history' AND match_user_id IS NULL THEN
    RAISE EXCEPTION 'chalk_hybrid_search: user_history requires match_user_id';
  END IF;
  IF search_mode NOT IN ('hybrid', 'dense', 'lexical') THEN
    RAISE EXCEPTION 'chalk_hybrid_search: unknown search_mode %', search_mode;
  END IF;

  RETURN QUERY
  WITH dense AS (
    SELECT c.id AS chunk_id,
           row_number() OVER (ORDER BY c.embedding <=> query_embedding) AS rank
    FROM chalk_chunks c
    WHERE c.scope = match_scope
      AND (match_scope = 'knowledge' OR c.user_id = match_user_id)
    ORDER BY c.embedding <=> query_embedding
    LIMIT 30
  ),
  lexical AS (
    SELECT c.id AS chunk_id,
           row_number() OVER (
             ORDER BY ts_rank_cd(c.fts, websearch_to_tsquery('english', query_text)) DESC
           ) AS rank
    FROM chalk_chunks c
    WHERE c.scope = match_scope
      AND (match_scope = 'knowledge' OR c.user_id = match_user_id)
      AND c.fts @@ websearch_to_tsquery('english', query_text)
    LIMIT 30
  )
  SELECT c.id, c.content, c.metadata, c.document_id, c.source_table, c.source_id,
         (CASE WHEN search_mode IN ('hybrid', 'dense')
               THEN COALESCE(1.0 / (rrf_k + dense.rank), 0) ELSE 0 END
          + CASE WHEN search_mode IN ('hybrid', 'lexical')
                 THEN COALESCE(1.0 / (rrf_k + lexical.rank), 0) ELSE 0 END
         )::double precision AS rrf_score
  FROM chalk_chunks c
  LEFT JOIN dense ON dense.chunk_id = c.id
  LEFT JOIN lexical ON lexical.chunk_id = c.id
  WHERE (search_mode IN ('hybrid', 'dense') AND dense.chunk_id IS NOT NULL)
     OR (search_mode IN ('hybrid', 'lexical') AND lexical.chunk_id IS NOT NULL)
  -- Positional: "rrf_score" would be ambiguous between the SELECT alias and
  -- the RETURNS TABLE output variable inside plpgsql.
  ORDER BY 7 DESC
  LIMIT match_count;
END;
$$;

-- Revoking PUBLIC also strips service_role's implicit execute, so grant it
-- back explicitly — the Edge Functions' admin client is the only caller.
REVOKE EXECUTE ON FUNCTION chalk_hybrid_search FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION chalk_hybrid_search FROM anon;
REVOKE EXECUTE ON FUNCTION chalk_hybrid_search FROM authenticated;
GRANT EXECUTE ON FUNCTION chalk_hybrid_search TO service_role;
