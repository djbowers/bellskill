ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS complex_set boolean;
UPDATE workout_logs SET complex_set = false WHERE complex_set IS NULL;
ALTER TABLE workout_logs ALTER COLUMN complex_set SET NOT NULL;
ALTER TABLE workout_logs ALTER COLUMN complex_set SET DEFAULT false;
