-- Chalk RAG (PROD-248): retrieval corpus tables.
--
-- Two scopes share one chunk table so one hybrid-search function serves both:
--   'knowledge'    — the coaching corpus (program descriptions, protocol
--                    articles, scoring-model docs), ingested by
--                    scripts/ingest-chalk-knowledge.mjs.
--   'user_history' — one chunk per logged workout with notes, written by the
--                    chalk-embed-history Edge Function.
--
-- Same access invariant as chalk_messages, but stricter: the service role is
-- the sole reader AND writer. Chunk content reaches the model's prompt, so a
-- client-writable row would be an injection channel; there is also no client
-- read path — retrieval happens entirely inside chalk-chat. RLS is enabled
-- with NO policies and no grants: anon/authenticated can do nothing here.
--
-- embedding is vector(384) because the embedding provider is Supabase's
-- built-in gte-small (see functions/_shared/embeddings.ts). Swapping providers
-- (e.g. Voyage, 1024-dim) requires ALTER COLUMN ... TYPE vector(1024) and a
-- full re-embed of every chunk — the dimension is part of the model contract.

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE chalk_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL
    CHECK (source_type IN ('program', 'doc', 'protocol')),
  -- program id, docs/ filename, or article slug; unique per source_type.
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  -- sha256 of the pre-chunk content; lets ingestion skip unchanged documents.
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_type, source_id)
);

CREATE TABLE chalk_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('knowledge', 'user_history')),
  -- knowledge scope: provenance via document; user_history: via user + source.
  document_id UUID REFERENCES chalk_documents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  source_table TEXT,
  -- TEXT, not UUID: workout_logs.id is an integer PK, and future sources may
  -- key differently.
  source_id TEXT,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  embedding extensions.vector(384) NOT NULL,
  -- Lexical leg of hybrid search; generated so it can never drift from content.
  fts TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (scope = 'knowledge' AND document_id IS NOT NULL AND user_id IS NULL)
    OR (scope = 'user_history' AND user_id IS NOT NULL
        AND source_table IS NOT NULL AND source_id IS NOT NULL)
  )
);

-- Idempotent upserts for the history embedder (one row per workout per user).
-- Not partial: PostgREST's on_conflict cannot target a partial index, and
-- knowledge rows are all-NULL on these columns so they never collide anyway.
CREATE UNIQUE INDEX idx_chalk_chunks_history_source
  ON chalk_chunks (user_id, source_table, source_id, chunk_index);

CREATE INDEX idx_chalk_chunks_embedding ON chalk_chunks
  USING hnsw (embedding extensions.vector_cosine_ops);

CREATE INDEX idx_chalk_chunks_fts ON chalk_chunks USING gin (fts);

CREATE INDEX idx_chalk_chunks_user ON chalk_chunks (user_id)
  WHERE scope = 'user_history';

ALTER TABLE chalk_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chalk_chunks ENABLE ROW LEVEL SECURITY;

-- No policies on purpose: service-role only, in both directions.
REVOKE ALL ON TABLE public.chalk_documents FROM anon;
REVOKE ALL ON TABLE public.chalk_documents FROM authenticated;
REVOKE ALL ON TABLE public.chalk_chunks FROM anon;
REVOKE ALL ON TABLE public.chalk_chunks FROM authenticated;
