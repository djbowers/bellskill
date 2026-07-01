ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS completed_sides smallint;

COMMENT ON COLUMN workout_logs.completed_sides IS
  'Number of sides completed across the workout. Each finished side of a one-handed or mixed-weight movement counts once, so a full mirror-set rung contributes two sides. Null for workouts logged before per-side tracking existed.';
