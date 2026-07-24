-- Straight sets: a second traversal order for the active-workout runtime, where
-- every rung of a movement is completed before the next movement starts. The
-- default order rotates through the movements one rung at a time, which is a
-- circuit -- wrong for templates like Easy Strength, which prescribe both sets of
-- a movement back to back.
--
-- Recorded alongside `complex_set` (the two are mutually exclusive arrangements)
-- so "Repeat workout" reconstructs the order the athlete actually trained.
-- Existing rows all ran the rotating order, so the `false` default is correct
-- history and no backfill is needed.

ALTER TABLE public.workout_logs
  ADD COLUMN straight_sets boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.workout_logs.straight_sets IS
  'When true, each movement''s full rep scheme was completed before advancing to the next movement, rather than rotating through the movements one rung at a time.';
