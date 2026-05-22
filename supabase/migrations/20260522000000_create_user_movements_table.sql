CREATE TABLE user_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  functional_movement_id UUID REFERENCES movements(id),
  canonical_name TEXT NOT NULL,
  is_big_6 BOOLEAN DEFAULT false,
  skill_tree_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_movements_user_canonical ON user_movements(user_id, canonical_name);

ALTER TABLE user_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own user_movements" ON user_movements
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own user_movements" ON user_movements
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own user_movements" ON user_movements
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own user_movements" ON user_movements
  FOR DELETE USING ((SELECT auth.uid()) = user_id);
