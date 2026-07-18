-- Seed the canonical shared Dry Fighting Weight program (Geoff Neupert),
-- 5-week / Day-1-ladders edition. Public + system-owned (owner_id NULL,
-- is_public true) so every user sees it and can one-tap "Start Dry Fighting
-- Weight"; enrolling clones it into an editable copy (enroll_in_program).
-- Idempotent on slug: a re-run (or a fresh env) skips re-seeding sessions.
--
-- Runs as the migration role, which bypasses RLS, so the NULL-owner public row
-- inserts cleanly. This is a MIGRATION (not seed.sql) so it also reaches
-- staging/production, where seed.sql never runs.
--
-- 14 trackable sessions (seq 0-13). Week 5 Day 3 is the rest/restoration day and
-- is intentionally NOT seeded (a session with no movements is not runnable in the
-- builder). num_weeks=5 / days_per_week=3 describe the wave, not the seeded count.
--
-- Several sessions model autoregulated source instructions; these are the modeled
-- defaults and are content-editable later (each is one row):
--   * seq 9  (W4D1) "Ladders 1-2-3-4-(5)"    -> [1,2,3,4]  (optional top rung dropped)
--   * seq 11 (W4D3) "Alternate 3s & 4s"       -> [3,4]      (2-rung wave)
--   * seq 12 (W5D1) "3x3 light"               -> [3,3,3]
--   * seq 13 (W5D2) "Test a new press max"    -> Clean and Press only, [5], 28 kg, 20 min
-- Load defaults are double-24 kg placeholders throughout so DFW is runnable out of
-- the box; the user adjusts load per session in the builder at start time.

-- Session-local helpers (pg_temp: auto-dropped at connection end, never persisted
-- to the committed schema) that build the WorkoutOptions JSONB for each session.
-- Shape MUST match Omit<WorkoutOptions,'startedAt'> exactly (camelCase keys).

-- Standard DFW session: Double Clean and Press + Double Front Squat, same rep
-- scheme on both, double-24 kg, 30-minute goal.
CREATE OR REPLACE FUNCTION pg_temp.dfw_options(p_reps INT[], p_details TEXT)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'complexSet', false,
    'intervalTimer', 0,
    'restTimer', 0,
    'workoutGoal', 30,
    'workoutGoalUnits', 'minutes',
    'workoutDetails', p_details,
    'sharedWeightOneUnit', NULL,
    'sharedWeightOneValue', NULL,
    'sharedWeightTwoUnit', NULL,
    'sharedWeightTwoValue', NULL,
    'movements', jsonb_build_array(
      jsonb_build_object(
        'movementName', 'Double Kettlebell Clean and Press',
        'repScheme', to_jsonb(p_reps),
        'weightOneUnit', 'kilograms', 'weightOneValue', 24,
        'weightTwoUnit', 'kilograms', 'weightTwoValue', 24),
      jsonb_build_object(
        'movementName', 'Front Squat With Two Kettlebells',
        'repScheme', to_jsonb(p_reps),
        'weightOneUnit', 'kilograms', 'weightOneValue', 24,
        'weightTwoUnit', 'kilograms', 'weightTwoValue', 24)
    ));
$$;

-- Test day (W5D2): single pressing movement, heavier bells, 20-minute goal.
CREATE OR REPLACE FUNCTION pg_temp.dfw_test_options()
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'complexSet', false,
    'intervalTimer', 0,
    'restTimer', 0,
    'workoutGoal', 20,
    'workoutGoalUnits', 'minutes',
    'workoutDetails', 'DFW W5D2 - Test a new press max (single heavy press)',
    'sharedWeightOneUnit', NULL,
    'sharedWeightOneValue', NULL,
    'sharedWeightTwoUnit', NULL,
    'sharedWeightTwoValue', NULL,
    'movements', jsonb_build_array(
      jsonb_build_object(
        'movementName', 'Double Kettlebell Clean and Press',
        'repScheme', to_jsonb(ARRAY[5]::INT[]),
        'weightOneUnit', 'kilograms', 'weightOneValue', 28,
        'weightTwoUnit', 'kilograms', 'weightTwoValue', 28)
    ));
$$;

DO $$
DECLARE
  v_program_id UUID;
BEGIN
  INSERT INTO programs (owner_id, slug, title, description, author_name, num_weeks, days_per_week, is_public)
  VALUES (NULL, 'dry-fighting-weight',
          'Dry Fighting Weight',
          'A 5-week double-kettlebell strength & recomposition program built on the '
          'Double Clean & Press and Double Front Squat, alternated for 30-minute sessions.',
          'Geoff Neupert', 5, 3, true)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO v_program_id;

  -- If the row already existed, skip re-seeding sessions.
  IF v_program_id IS NULL THEN
    RAISE NOTICE 'DFW program already seeded; skipping sessions.';
    RETURN;
  END IF;

  INSERT INTO program_sessions
    (program_id, sequence_index, week_number, day_number, title, workout_options)
  VALUES
    (v_program_id,  0, 1, 1, 'Ladders 1-2-3',       pg_temp.dfw_options(ARRAY[1,2,3]::INT[],   'DFW W1D1 - Ladders 1-2-3 - use your 5RM press')),
    (v_program_id,  1, 1, 2, 'Sets of 1',           pg_temp.dfw_options(ARRAY[1]::INT[],       'DFW W1D2 - Sets of 1')),
    (v_program_id,  2, 1, 3, 'Sets of 2',           pg_temp.dfw_options(ARRAY[2]::INT[],       'DFW W1D3 - Sets of 2')),
    (v_program_id,  3, 2, 1, 'Ladders 1-2-3',       pg_temp.dfw_options(ARRAY[1,2,3]::INT[],   'DFW W2D1 - Ladders 1-2-3')),
    (v_program_id,  4, 2, 2, 'Sets of 1',           pg_temp.dfw_options(ARRAY[1]::INT[],       'DFW W2D2 - Sets of 1')),
    (v_program_id,  5, 2, 3, 'Sets of 3',           pg_temp.dfw_options(ARRAY[3]::INT[],       'DFW W2D3 - Sets of 3')),
    (v_program_id,  6, 3, 1, 'Ladders 1-2-3-4',     pg_temp.dfw_options(ARRAY[1,2,3,4]::INT[], 'DFW W3D1 - Ladders 1-2-3-4')),
    (v_program_id,  7, 3, 2, 'Sets of 2',           pg_temp.dfw_options(ARRAY[2]::INT[],       'DFW W3D2 - Sets of 2')),
    (v_program_id,  8, 3, 3, 'Sets of 3',           pg_temp.dfw_options(ARRAY[3]::INT[],       'DFW W3D3 - Sets of 3')),
    (v_program_id,  9, 4, 1, 'Ladders 1-2-3-4',     pg_temp.dfw_options(ARRAY[1,2,3,4]::INT[], 'DFW W4D1 - Ladders 1-2-3-4 (optional top rung of 5)')),
    (v_program_id, 10, 4, 2, 'Sets of 2',           pg_temp.dfw_options(ARRAY[2]::INT[],       'DFW W4D2 - Sets of 2')),
    (v_program_id, 11, 4, 3, 'Alternating 3s & 4s', pg_temp.dfw_options(ARRAY[3,4]::INT[],     'DFW W4D3 - Alternate sets of 3 and 4')),
    (v_program_id, 12, 5, 1, 'Light 3x3',           pg_temp.dfw_options(ARRAY[3,3,3]::INT[],   'DFW W5D1 - Light 3x3 (deload before test)')),
    (v_program_id, 13, 5, 2, 'Test - new press max', pg_temp.dfw_test_options());
END $$;
