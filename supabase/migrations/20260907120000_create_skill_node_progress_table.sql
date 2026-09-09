CREATE TABLE skill_node_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'complete')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, node_id),
  CONSTRAINT completed_at_matches_status CHECK (
    (status = 'complete' AND completed_at IS NOT NULL)
    OR (status = 'active' AND completed_at IS NULL)
  )
);

ALTER TABLE skill_node_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own skill_node_progress" ON skill_node_progress
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own skill_node_progress" ON skill_node_progress
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own skill_node_progress" ON skill_node_progress
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own skill_node_progress" ON skill_node_progress
  FOR DELETE USING ((SELECT auth.uid()) = user_id);
