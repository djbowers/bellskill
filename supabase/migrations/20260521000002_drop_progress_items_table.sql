DROP POLICY IF EXISTS "Users can view own progress items" ON progress_items;
DROP POLICY IF EXISTS "Users can insert own progress items" ON progress_items;
DROP POLICY IF EXISTS "Users can update own progress items" ON progress_items;
DROP POLICY IF EXISTS "Users can delete own progress items" ON progress_items;

DROP TABLE IF EXISTS progress_items;
