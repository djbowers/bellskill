-- Persist whether a logged movement was run one leg at a time.
--
-- Completed-workout history renders "5 / 5" per side. That was inferred from
-- `weight_two_value = 0` (one bell, one hand), which misses every unilateral
-- leg movement held with two hands or two bells. The builder now carries the
-- flag explicitly, so the log has to keep it.

ALTER TABLE public.movement_logs
  ADD COLUMN IF NOT EXISTS unilateral boolean NOT NULL DEFAULT false;
