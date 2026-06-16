-- AI Next Session Recommender (PROD-86): tracking table + profiles.training_goal.
--
-- session_recommendations logs every recommendation the recommend-session Edge
-- Function (PROD-87) generates, for analytics and prompt iteration (PROD-88).
-- The Edge Function is the SOLE writer, via the service role (which bypasses
-- RLS); clients may only read their own rows. A client UPDATE policy for
-- Accept/Reject (status/acted_at) is deferred to the UI slice (PROD-89).

CREATE TABLE session_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Snapshot of what fed the LLM: recent history summary, training_goal, daily
  -- readiness/feeling, days-since-last-workout, candidate movement ids. The
  -- pattern_debt / unlocked_weights keys are reserved but empty for now
  -- (PROD-75 / PROD-78 deferred).
  inputs JSONB NOT NULL,
  -- Raw validated LLM output. NULL when status = 'error'.
  output JSONB,
  status TEXT NOT NULL DEFAULT 'generated'
    CHECK (status IN ('generated', 'accepted', 'rejected', 'regenerated', 'error')),
  error TEXT,
  acted_at TIMESTAMPTZ,
  workout_log_id BIGINT REFERENCES workout_logs(id) ON DELETE SET NULL
);

CREATE INDEX idx_session_recommendations_user_created
  ON session_recommendations(user_id, created_at DESC);

CREATE INDEX idx_session_recommendations_status
  ON session_recommendations(status);

ALTER TABLE session_recommendations ENABLE ROW LEVEL SECURITY;

-- Read-own only. There is intentionally no client INSERT/UPDATE/DELETE policy:
-- the recommend-session Edge Function writes via the service role.
CREATE POLICY "Users can view own session_recommendations" ON session_recommendations
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- Table privileges: authenticated needs SELECT only (RLS narrows to own rows);
-- anon gets nothing, consistent with the rest of the schema.
REVOKE ALL ON TABLE public.session_recommendations FROM anon;
REVOKE ALL ON TABLE public.session_recommendations FROM authenticated;
GRANT SELECT ON TABLE public.session_recommendations TO authenticated;

-- profiles.training_goal: persistent free-text training goal fed to the
-- recommender (PROD-151). profiles INSERT/UPDATE are column-locked
-- (20260612000000_add_subscription_entitlement.sql), so extend the column-level
-- grants to include the new column. Column privileges are additive in Postgres.
ALTER TABLE public.profiles ADD COLUMN training_goal TEXT;

GRANT UPDATE (training_goal) ON public.profiles TO authenticated;
GRANT INSERT (training_goal) ON public.profiles TO authenticated;
