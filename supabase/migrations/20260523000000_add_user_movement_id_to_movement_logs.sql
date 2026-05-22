ALTER TABLE movement_logs
  ADD COLUMN user_movement_id UUID REFERENCES user_movements(id);
