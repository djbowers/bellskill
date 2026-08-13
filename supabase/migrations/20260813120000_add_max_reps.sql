-- Max reps and per-set actuals.
--
-- Two gaps, one root: the client only ever persisted the PLAN. `rep_scheme` is
-- the prescription and `workout_logs.completed_reps` is a single aggregate the
-- runner derives from it, so a set taken to failure had no number to record and
-- a set that fell short of its rung was logged as if it hadn't.
--
-- `completed_rep_scheme` is the actuals record: one entry per set actually
-- completed, in completion order, for every movement -- across rounds and
-- mirrored sides, so it is NOT index-aligned with `rep_scheme`. Null on every
-- pre-existing row, which is the honest "we never captured this".
--
-- `max_reps` marks a movement whose sets are taken to failure. For those rows
-- the client writes the FIRST ladder pass of the actuals into `rep_scheme`,
-- since a max-reps movement has no prescription and every consumer of
-- `rep_scheme` (pattern_debt_movements, history, repeat-workout) reads it as one
-- ladder pass and scales it by completed_rounds itself. That keeps those
-- consumers correct with no change to their SQL.

ALTER TABLE public.movement_logs
  ADD COLUMN max_reps boolean NOT NULL DEFAULT false,
  ADD COLUMN completed_rep_scheme smallint[];

COMMENT ON COLUMN public.movement_logs.max_reps IS
  'When true, sets were taken to failure and rep_scheme holds the first pass of actuals rather than a prescription.';

COMMENT ON COLUMN public.movement_logs.completed_rep_scheme IS
  'Reps actually completed, one entry per set in completion order across all rounds and sides. Not index-aligned with rep_scheme.';
