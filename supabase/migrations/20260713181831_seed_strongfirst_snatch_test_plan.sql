-- Seed the shared StrongFirst Snatch Test Training Plan (Dr. Michael Hartle).
-- Public + system-owned (owner_id NULL, is_public true) so every user sees it
-- and can one-tap "Start"; enrolling clones it into an editable copy
-- (enroll_in_program). Idempotent on slug: a re-run (or fresh env) skips
-- re-seeding sessions. This is a MIGRATION (not seed.sql) so it also reaches
-- staging/production, where seed.sql never runs. Surfaced only behind the
-- `programs` feature flag, like DFW.
--
-- Source: https://www.strongfirst.com/snatch-test-training-plan/ — the official
-- free plan for StrongFirst's own snatch-test certification. 10 weeks, 3x/wk.
--
-- MODELING DECISIONS (this plan is an approximation of prose programming, same
-- as DFW's autoregulated days — the calls below are the product-review-worthy
-- ones):
--
--   * The plan's defining feature is REST SHRINKING WEEK OVER WEEK. That maps
--     directly onto `restTimer` varying session-to-session: every session in a
--     given week shares one restTimer, and it decreases strictly each week
--     (45s -> 8s across the 10 weeks). This is the whole reason the plan was
--     picked; the e2e spec asserts the monotonic decrease.
--
--   * Weeks 1-7 ("build"): 6 sets alternating One-Arm Swing / One-Arm Snatch,
--     20 reps/set. Modeled as two movements (complexSet:false, so they alternate
--     rung-by-rung exactly like DFW's press/squat pairing), each repScheme [20],
--     with `workoutGoalUnits:'rounds'`, `workoutGoal:3` -- 3 rounds x 2 movements
--     = the 6 alternating sets. (One round = one swing set + one snatch set.)
--
--   * Weeks 8-10 ("test prep + test week"): the 100-snatch test simulation,
--     5 sets of 20 = 100 reps, snatch only. Modeled as a single One-Arm Snatch
--     movement, repScheme [20], `workoutGoal:5` rounds (single-movement round =
--     one set, so 5 rounds = 5 sets = 100 reps).
--
--   * Bell rotation heavy/medium/light is one weight per movement per session
--     (no in-session variation), so it's encoded as `weightOneValue` varying by
--     DAY across each week: Day1 28 kg (heavy) / Day2 24 kg (medium) / Day3
--     20 kg (light). These are PLACEHOLDERS around the 24 kg test standard; the
--     user overrides load per session in the builder, exactly like DFW's loads.
--     One-Arm movements are single-bell, so weightTwo is NULL throughout.
--
--   * One-Arm movements are mirrored (per-hand) by the runtime, so "20 reps/set"
--     is tracked per hand; the source's "100 total reps" is the per-side target.
--     `workoutDetails` notes this on each session.
--
-- 30 trackable sessions (seq 0-29 = 10 weeks x 3 days). num_weeks=10 /
-- days_per_week=3.

-- Session-local helpers (pg_temp: auto-dropped at connection end, never
-- persisted to the committed schema) that build the WorkoutOptions JSONB.
-- Shape MUST match Omit<WorkoutOptions,'startedAt'> exactly (camelCase keys).

-- Weeks 1-7 build session: One-Arm Swing + One-Arm Snatch alternating,
-- 6 sets (3 rounds) of 20 reps, single bell, rest shrinking by week.
CREATE OR REPLACE FUNCTION pg_temp.snatch_build_options(p_rest INT, p_weight INT, p_details TEXT)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'complexSet', false,
    'intervalTimer', 0,
    'restTimer', p_rest,
    'workoutGoal', 3,
    'workoutGoalUnits', 'rounds',
    'workoutDetails', p_details,
    'sharedWeightOneUnit', NULL,
    'sharedWeightOneValue', NULL,
    'sharedWeightTwoUnit', NULL,
    'sharedWeightTwoValue', NULL,
    'movements', jsonb_build_array(
      jsonb_build_object(
        'movementName', 'One-Arm Kettlebell Swing',
        'repScheme', to_jsonb(ARRAY[20]::INT[]),
        'weightOneUnit', 'kilograms', 'weightOneValue', p_weight,
        'weightTwoUnit', NULL, 'weightTwoValue', NULL),
      jsonb_build_object(
        'movementName', 'One-Arm Kettlebell Snatch',
        'repScheme', to_jsonb(ARRAY[20]::INT[]),
        'weightOneUnit', 'kilograms', 'weightOneValue', p_weight,
        'weightTwoUnit', NULL, 'weightTwoValue', NULL)
    ));
$$;

-- Weeks 8-10 test-prep session: One-Arm Snatch only, 5 sets (5 rounds) of 20 =
-- 100 reps, single bell, rest shrinking by week.
CREATE OR REPLACE FUNCTION pg_temp.snatch_test_options(p_rest INT, p_weight INT, p_details TEXT)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'complexSet', false,
    'intervalTimer', 0,
    'restTimer', p_rest,
    'workoutGoal', 5,
    'workoutGoalUnits', 'rounds',
    'workoutDetails', p_details,
    'sharedWeightOneUnit', NULL,
    'sharedWeightOneValue', NULL,
    'sharedWeightTwoUnit', NULL,
    'sharedWeightTwoValue', NULL,
    'movements', jsonb_build_array(
      jsonb_build_object(
        'movementName', 'One-Arm Kettlebell Snatch',
        'repScheme', to_jsonb(ARRAY[20]::INT[]),
        'weightOneUnit', 'kilograms', 'weightOneValue', p_weight,
        'weightTwoUnit', NULL, 'weightTwoValue', NULL)
    ));
$$;

DO $$
DECLARE
  v_program_id UUID;
BEGIN
  INSERT INTO programs (owner_id, slug, title, description, author_name, num_weeks, days_per_week, is_public)
  VALUES (NULL, 'strongfirst-snatch-test-plan',
          'StrongFirst Snatch Test Training Plan',
          'A 10-week single-kettlebell plan to pass the StrongFirst snatch test. '
          'Weeks 1-7 alternate one-arm swings and snatches for 6 sets of 20 with '
          'rest shrinking every week; weeks 8-10 rehearse the 100-rep snatch test.',
          'Dr. Michael Hartle (StrongFirst)', 10, 3, true)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO v_program_id;

  -- If the row already existed, skip re-seeding sessions.
  IF v_program_id IS NULL THEN
    RAISE NOTICE 'Snatch Test program already seeded; skipping sessions.';
    RETURN;
  END IF;

  -- Rest shrinks strictly week over week (the defining feature). Weight rotates
  -- heavy(28)/medium(24)/light(20) by day within each week. Weeks 1-7 build
  -- (swing+snatch); weeks 8-10 rehearse the 100-snatch test (snatch only).
  INSERT INTO program_sessions
    (program_id, sequence_index, week_number, day_number, title, workout_options)
  VALUES
    (v_program_id,  0,  1, 1, 'Heavy - swing/snatch',  pg_temp.snatch_build_options(45, 28, 'Snatch Test W1D1 - Heavy - 6 sets alternating one-arm swing/snatch, 20 reps/set (per hand), rest 45s. Load is a placeholder; adjust in the builder.')),
    (v_program_id,  1,  1, 2, 'Medium - swing/snatch', pg_temp.snatch_build_options(45, 24, 'Snatch Test W1D2 - Medium - 6 sets alternating one-arm swing/snatch, 20 reps/set (per hand), rest 45s.')),
    (v_program_id,  2,  1, 3, 'Light - swing/snatch',  pg_temp.snatch_build_options(45, 20, 'Snatch Test W1D3 - Light - 6 sets alternating one-arm swing/snatch, 20 reps/set (per hand), rest 45s.')),
    (v_program_id,  3,  2, 1, 'Heavy - swing/snatch',  pg_temp.snatch_build_options(40, 28, 'Snatch Test W2D1 - Heavy - 6 sets alternating one-arm swing/snatch, 20 reps/set (per hand), rest 40s.')),
    (v_program_id,  4,  2, 2, 'Medium - swing/snatch', pg_temp.snatch_build_options(40, 24, 'Snatch Test W2D2 - Medium - 6 sets alternating one-arm swing/snatch, 20 reps/set (per hand), rest 40s.')),
    (v_program_id,  5,  2, 3, 'Light - swing/snatch',  pg_temp.snatch_build_options(40, 20, 'Snatch Test W2D3 - Light - 6 sets alternating one-arm swing/snatch, 20 reps/set (per hand), rest 40s.')),
    (v_program_id,  6,  3, 1, 'Heavy - swing/snatch',  pg_temp.snatch_build_options(35, 28, 'Snatch Test W3D1 - Heavy - 6 sets alternating one-arm swing/snatch, 20 reps/set (per hand), rest 35s.')),
    (v_program_id,  7,  3, 2, 'Medium - swing/snatch', pg_temp.snatch_build_options(35, 24, 'Snatch Test W3D2 - Medium - 6 sets alternating one-arm swing/snatch, 20 reps/set (per hand), rest 35s.')),
    (v_program_id,  8,  3, 3, 'Light - swing/snatch',  pg_temp.snatch_build_options(35, 20, 'Snatch Test W3D3 - Light - 6 sets alternating one-arm swing/snatch, 20 reps/set (per hand), rest 35s.')),
    (v_program_id,  9,  4, 1, 'Heavy - swing/snatch',  pg_temp.snatch_build_options(30, 28, 'Snatch Test W4D1 - Heavy - 6 sets alternating one-arm swing/snatch, 20 reps/set (per hand), rest 30s.')),
    (v_program_id, 10,  4, 2, 'Medium - swing/snatch', pg_temp.snatch_build_options(30, 24, 'Snatch Test W4D2 - Medium - 6 sets alternating one-arm swing/snatch, 20 reps/set (per hand), rest 30s.')),
    (v_program_id, 11,  4, 3, 'Light - swing/snatch',  pg_temp.snatch_build_options(30, 20, 'Snatch Test W4D3 - Light - 6 sets alternating one-arm swing/snatch, 20 reps/set (per hand), rest 30s.')),
    (v_program_id, 12,  5, 1, 'Heavy - swing/snatch',  pg_temp.snatch_build_options(25, 28, 'Snatch Test W5D1 - Heavy - 6 sets alternating one-arm swing/snatch, 20 reps/set (per hand), rest 25s.')),
    (v_program_id, 13,  5, 2, 'Medium - swing/snatch', pg_temp.snatch_build_options(25, 24, 'Snatch Test W5D2 - Medium - 6 sets alternating one-arm swing/snatch, 20 reps/set (per hand), rest 25s.')),
    (v_program_id, 14,  5, 3, 'Light - swing/snatch',  pg_temp.snatch_build_options(25, 20, 'Snatch Test W5D3 - Light - 6 sets alternating one-arm swing/snatch, 20 reps/set (per hand), rest 25s.')),
    (v_program_id, 15,  6, 1, 'Heavy - swing/snatch',  pg_temp.snatch_build_options(20, 28, 'Snatch Test W6D1 - Heavy - 6 sets alternating one-arm swing/snatch, 20 reps/set (per hand), rest 20s.')),
    (v_program_id, 16,  6, 2, 'Medium - swing/snatch', pg_temp.snatch_build_options(20, 24, 'Snatch Test W6D2 - Medium - 6 sets alternating one-arm swing/snatch, 20 reps/set (per hand), rest 20s.')),
    (v_program_id, 17,  6, 3, 'Light - swing/snatch',  pg_temp.snatch_build_options(20, 20, 'Snatch Test W6D3 - Light - 6 sets alternating one-arm swing/snatch, 20 reps/set (per hand), rest 20s.')),
    (v_program_id, 18,  7, 1, 'Heavy - swing/snatch',  pg_temp.snatch_build_options(15, 28, 'Snatch Test W7D1 - Heavy - 6 sets alternating one-arm swing/snatch, 20 reps/set (per hand), rest 15s.')),
    (v_program_id, 19,  7, 2, 'Medium - swing/snatch', pg_temp.snatch_build_options(15, 24, 'Snatch Test W7D2 - Medium - 6 sets alternating one-arm swing/snatch, 20 reps/set (per hand), rest 15s.')),
    (v_program_id, 20,  7, 3, 'Light - swing/snatch',  pg_temp.snatch_build_options(15, 20, 'Snatch Test W7D3 - Light - 6 sets alternating one-arm swing/snatch, 20 reps/set (per hand), rest 15s.')),
    (v_program_id, 21,  8, 1, 'Test prep - 100 snatches', pg_temp.snatch_test_options(12, 28, 'Snatch Test W8D1 - Heavy - 100-snatch rehearsal: 5 sets of 20 (per hand), rest 12s. Load is a placeholder; the 24 kg (men) / 16 kg (women) test bell is the standard.')),
    (v_program_id, 22,  8, 2, 'Test prep - 100 snatches', pg_temp.snatch_test_options(12, 24, 'Snatch Test W8D2 - Medium - 100-snatch rehearsal: 5 sets of 20 (per hand), rest 12s.')),
    (v_program_id, 23,  8, 3, 'Test prep - 100 snatches', pg_temp.snatch_test_options(12, 20, 'Snatch Test W8D3 - Light - 100-snatch rehearsal: 5 sets of 20 (per hand), rest 12s.')),
    (v_program_id, 24,  9, 1, 'Test prep - 100 snatches', pg_temp.snatch_test_options(10, 28, 'Snatch Test W9D1 - Heavy - 100-snatch rehearsal: 5 sets of 20 (per hand), rest 10s.')),
    (v_program_id, 25,  9, 2, 'Test prep - 100 snatches', pg_temp.snatch_test_options(10, 24, 'Snatch Test W9D2 - Medium - 100-snatch rehearsal: 5 sets of 20 (per hand), rest 10s.')),
    (v_program_id, 26,  9, 3, 'Test prep - 100 snatches', pg_temp.snatch_test_options(10, 20, 'Snatch Test W9D3 - Light - 100-snatch rehearsal: 5 sets of 20 (per hand), rest 10s.')),
    (v_program_id, 27, 10, 1, 'Test week - 100 snatches', pg_temp.snatch_test_options(8, 24, 'Snatch Test W10D1 - Test week - 100 snatches with the test bell (24 kg men / 16 kg women). 5 sets of 20 (per hand), minimal rest 8s; on test day the standard is 100 reps in 5 minutes.')),
    (v_program_id, 28, 10, 2, 'Test week - practice',     pg_temp.snatch_test_options(8, 20, 'Snatch Test W10D2 - Test week - light practice: 5 sets of 20 (per hand), rest 8s.')),
    (v_program_id, 29, 10, 3, 'Test week - the test',     pg_temp.snatch_test_options(8, 24, 'Snatch Test W10D3 - THE TEST - 100 snatches, test bell, as few sets as possible in 5 minutes. Modeled as 5 sets of 20 (per hand); rest 8s is a placeholder for a continuous effort.'));
END $$;
