ALTER TABLE workout_logs
  ADD COLUMN IF NOT EXISTS shared_weight_one_value double precision,
  ADD COLUMN IF NOT EXISTS shared_weight_one_unit weight_unit,
  ADD COLUMN IF NOT EXISTS shared_weight_two_value double precision,
  ADD COLUMN IF NOT EXISTS shared_weight_two_unit weight_unit;
