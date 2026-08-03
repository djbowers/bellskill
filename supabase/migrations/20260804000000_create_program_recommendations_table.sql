-- AI Program Recommender: tracking table for the recommend-program Edge
-- Function. Mirrors session_recommendations
-- (20260616000000_create_session_recommendations_table.sql): the Edge Function
-- is the SOLE writer, via the service role (which bypasses RLS); clients may
-- only read their own rows. Every attempt (success or error) is logged for
-- analytics and prompt iteration. A separate table from session_recommendations
-- because the output shape (one program + enroll mode) and FK linkage
-- (programs, not workout_logs) are disjoint.

CREATE TABLE program_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Snapshot of what fed the LLM: active/queued programs, candidate catalog
  -- with stack-fit verdicts, pattern-debt balance, recent history summary.
  inputs JSONB NOT NULL,
  -- Raw validated LLM output. NULL when status = 'error'.
  output JSONB,
  status TEXT NOT NULL DEFAULT 'generated'
    CHECK (status IN ('generated', 'accepted', 'rejected', 'regenerated', 'error')),
  error TEXT,
  acted_at TIMESTAMPTZ,
  program_id UUID REFERENCES programs(id) ON DELETE SET NULL
);

CREATE INDEX idx_program_recommendations_user_created
  ON program_recommendations(user_id, created_at DESC);

CREATE INDEX idx_program_recommendations_status
  ON program_recommendations(status);

ALTER TABLE program_recommendations ENABLE ROW LEVEL SECURITY;

-- Read-own only. There is intentionally no client INSERT/UPDATE/DELETE policy:
-- the recommend-program Edge Function writes via the service role.
CREATE POLICY "Users can view own program_recommendations" ON program_recommendations
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.program_recommendations FROM anon;
REVOKE ALL ON TABLE public.program_recommendations FROM authenticated;
GRANT SELECT ON TABLE public.program_recommendations TO authenticated;
