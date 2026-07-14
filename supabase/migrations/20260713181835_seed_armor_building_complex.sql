-- Seed the canonical shared Armor Building Complex (Dan John) program.
-- Public + system-owned (owner_id NULL, is_public true) so every user sees it
-- and can one-tap "Start Armor Building Complex"; enrolling clones it into an
-- editable copy (enroll_in_program). Idempotent on slug: a re-run (or a fresh
-- env) skips re-seeding sessions.
--
-- Runs as the migration role, which bypasses RLS, so the NULL-owner public row
-- inserts cleanly. This is a MIGRATION (not seed.sql) so it also reaches
-- staging/production, where seed.sql never runs.
--
-- FIRST shipped program to use complexSet=true. Unlike DFW (complexSet=false,
-- movements alternate rung-by-rung), the ABC is one flowing double-KB chain per
-- round -- clean -> press -> squat, bells never set down. In the runtime
-- (ActiveWorkoutPage.tsx:204-207 / ComplexMovementDisplay.tsx) each movement
-- carries a SINGLE-element repScheme, so maxMovementRungs = 1 and ONE "continue"
-- press completes a whole round (2 cleans, 1 press, 3 squats shown together).
-- The complex display renders the SHARED weight pair (sharedWeightOne/Two), so
-- those are populated here -- DFW leaves them NULL because its per-movement
-- display path reads the per-movement weights instead. Per-movement weights are
-- also set (double 24 kg) so completed-volume tracking stays correct.
--
-- Round-progression ramp (progression = add ROUNDS, not weight -- ABC has no
-- canonical numeric table in the source; report.md confirms this). Sensible
-- linear default: start at 5 rounds, add ~1 round/week, reaching the classic
-- "10 rounds" ABC benchmark by week 5, then holding it. num_weeks=5 /
-- days_per_week=4 describe the ~30-day, 3-5x/wk arc (labels only); the 20 seeded
-- session rows carry the actual programming. Each ramp step is documented in the
-- session's workoutDetails and is content-editable later.
--   W1: 5, 5, 6, 6   W2: 6, 7, 7, 7   W3: 8, 8, 8, 8   W4: 9, 9, 9, 9   W5: 10 x4
-- restTimer is 30 s BETWEEN rounds (within a round the bells never leave the
-- rack); it is a runnable default and editable at start. intervalTimer=0 (unused).

-- Session-local helper (pg_temp: auto-dropped at connection end, never persisted
-- to the committed schema) that builds the WorkoutOptions JSONB for one ABC
-- session. Shape MUST match Omit<WorkoutOptions,'startedAt'> exactly (camelCase).
CREATE OR REPLACE FUNCTION pg_temp.abc_options(p_rounds INT, p_details TEXT)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'complexSet', true,
    'intervalTimer', 0,
    'restTimer', 30,
    'workoutGoal', p_rounds,
    'workoutGoalUnits', 'rounds',
    'workoutDetails', p_details,
    'sharedWeightOneUnit', 'kilograms',
    'sharedWeightOneValue', 24,
    'sharedWeightTwoUnit', 'kilograms',
    'sharedWeightTwoValue', 24,
    'movements', jsonb_build_array(
      jsonb_build_object(
        'movementName', 'Two-Arm Kettlebell Clean',
        'repScheme', to_jsonb(ARRAY[2]::INT[]),
        'weightOneUnit', 'kilograms', 'weightOneValue', 24,
        'weightTwoUnit', 'kilograms', 'weightTwoValue', 24),
      jsonb_build_object(
        'movementName', 'Two-Arm Kettlebell Military Press',
        'repScheme', to_jsonb(ARRAY[1]::INT[]),
        'weightOneUnit', 'kilograms', 'weightOneValue', 24,
        'weightTwoUnit', 'kilograms', 'weightTwoValue', 24),
      jsonb_build_object(
        'movementName', 'Front Squat With Two Kettlebells',
        'repScheme', to_jsonb(ARRAY[3]::INT[]),
        'weightOneUnit', 'kilograms', 'weightOneValue', 24,
        'weightTwoUnit', 'kilograms', 'weightTwoValue', 24)
    ));
$$;

DO $$
DECLARE
  v_program_id UUID;
BEGIN
  INSERT INTO programs (owner_id, slug, title, description, author_name, num_weeks, days_per_week, is_public)
  VALUES (NULL, 'armor-building-complex',
          'Armor Building Complex',
          'A double-kettlebell complex done without setting the bells down: '
          'clean, press, squat back-to-back = one round. Build from 5 to 10 '
          'rounds over ~5 weeks, 3-5x/week. Progression is adding rounds, not weight.',
          'Dan John', 5, 4, true)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO v_program_id;

  -- If the row already existed, skip re-seeding sessions.
  IF v_program_id IS NULL THEN
    RAISE NOTICE 'Armor Building Complex program already seeded; skipping sessions.';
    RETURN;
  END IF;

  INSERT INTO program_sessions
    (program_id, sequence_index, week_number, day_number, title, workout_options)
  VALUES
    (v_program_id,  0, 1, 1, '5 rounds',  pg_temp.abc_options(5,  'ABC W1D1 - 5 rounds. One round = 2 cleans, 1 press, 3 squats (double bells, never set down). ~30s rest between rounds (editable).')),
    (v_program_id,  1, 1, 2, '5 rounds',  pg_temp.abc_options(5,  'ABC W1D2 - 5 rounds. Ease in; keep every round crisp.')),
    (v_program_id,  2, 1, 3, '6 rounds',  pg_temp.abc_options(6,  'ABC W1D3 - 6 rounds.')),
    (v_program_id,  3, 1, 4, '6 rounds',  pg_temp.abc_options(6,  'ABC W1D4 - 6 rounds.')),
    (v_program_id,  4, 2, 1, '6 rounds',  pg_temp.abc_options(6,  'ABC W2D1 - 6 rounds.')),
    (v_program_id,  5, 2, 2, '7 rounds',  pg_temp.abc_options(7,  'ABC W2D2 - 7 rounds.')),
    (v_program_id,  6, 2, 3, '7 rounds',  pg_temp.abc_options(7,  'ABC W2D3 - 7 rounds.')),
    (v_program_id,  7, 2, 4, '7 rounds',  pg_temp.abc_options(7,  'ABC W2D4 - 7 rounds.')),
    (v_program_id,  8, 3, 1, '8 rounds',  pg_temp.abc_options(8,  'ABC W3D1 - 8 rounds.')),
    (v_program_id,  9, 3, 2, '8 rounds',  pg_temp.abc_options(8,  'ABC W3D2 - 8 rounds.')),
    (v_program_id, 10, 3, 3, '8 rounds',  pg_temp.abc_options(8,  'ABC W3D3 - 8 rounds.')),
    (v_program_id, 11, 3, 4, '8 rounds',  pg_temp.abc_options(8,  'ABC W3D4 - 8 rounds.')),
    (v_program_id, 12, 4, 1, '9 rounds',  pg_temp.abc_options(9,  'ABC W4D1 - 9 rounds.')),
    (v_program_id, 13, 4, 2, '9 rounds',  pg_temp.abc_options(9,  'ABC W4D2 - 9 rounds.')),
    (v_program_id, 14, 4, 3, '9 rounds',  pg_temp.abc_options(9,  'ABC W4D3 - 9 rounds.')),
    (v_program_id, 15, 4, 4, '9 rounds',  pg_temp.abc_options(9,  'ABC W4D4 - 9 rounds.')),
    (v_program_id, 16, 5, 1, '10 rounds', pg_temp.abc_options(10, 'ABC W5D1 - 10 rounds. The classic ABC benchmark.')),
    (v_program_id, 17, 5, 2, '10 rounds', pg_temp.abc_options(10, 'ABC W5D2 - 10 rounds.')),
    (v_program_id, 18, 5, 3, '10 rounds', pg_temp.abc_options(10, 'ABC W5D3 - 10 rounds.')),
    (v_program_id, 19, 5, 4, '10 rounds', pg_temp.abc_options(10, 'ABC W5D4 - 10 rounds. Own the full 10.'));
END $$;
