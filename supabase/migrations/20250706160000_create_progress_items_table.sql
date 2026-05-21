-- Create progress_items table for PARA method tracking
CREATE TABLE progress_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  max_xp INTEGER NOT NULL DEFAULT 100,
  category TEXT NOT NULL,
  icon_name TEXT,
  type TEXT NOT NULL CHECK (type IN ('project', 'area', 'resource', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_progress_items_user_type ON progress_items(user_id, type);
CREATE INDEX idx_progress_items_created_at ON progress_items(created_at);

-- Enable Row Level Security
ALTER TABLE progress_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own progress items" ON progress_items
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own progress items" ON progress_items
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own progress items" ON progress_items
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own progress items" ON progress_items
  FOR DELETE USING ((SELECT auth.uid()) = user_id);