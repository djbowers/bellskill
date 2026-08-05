CREATE TYPE equipment_kind AS ENUM ('fixed', 'adjustable');

CREATE TABLE user_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind equipment_kind NOT NULL,
  weight NUMERIC(6, 2),
  min_weight NUMERIC(6, 2),
  max_weight NUMERIC(6, 2),
  step_weight NUMERIC(6, 2),
  unit weight_unit NOT NULL DEFAULT 'kilograms',
  quantity SMALLINT NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT kind_fields CHECK (
    (
      kind = 'fixed'
      AND weight IS NOT NULL AND weight > 0
      AND min_weight IS NULL AND max_weight IS NULL AND step_weight IS NULL
    )
    OR (
      kind = 'adjustable'
      AND weight IS NULL
      AND min_weight IS NOT NULL AND min_weight > 0
      AND step_weight IS NOT NULL AND step_weight > 0
      AND max_weight IS NOT NULL AND max_weight >= min_weight
    )
  )
);

CREATE INDEX idx_user_equipment_user ON user_equipment(user_id);

ALTER TABLE user_equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own user_equipment" ON user_equipment
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own user_equipment" ON user_equipment
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own user_equipment" ON user_equipment
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own user_equipment" ON user_equipment
  FOR DELETE USING ((SELECT auth.uid()) = user_id);
