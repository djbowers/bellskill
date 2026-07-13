-- Seed the shared 10,000 Swing Challenge program (Dan John). Public +
-- system-owned (owner_id NULL, is_public true) so every user sees it and can
-- one-tap "Start"; enrolling clones it into an editable copy (enroll_in_program).
-- Idempotent on slug: a re-run (or a fresh env) skips re-seeding sessions.
--
-- Runs as the migration role, which bypasses RLS, so the NULL-owner public row
-- inserts cleanly. This is a MIGRATION (not seed.sql) so it also reaches
-- staging/production, where seed.sql never runs. Mirrors the DFW seed migration
-- (20260706170001_seed_dry_fighting_weight.sql) conventions exactly.
--
-- 20 trackable sessions (seq 0-19), 4 weeks x 5 days. Every session is identical:
-- 500 swings as a 100-rep cluster (10/15/25/50) repeated 5 times. The load and
-- reps are flat for all 4 weeks -- this is a conditioning target, not a strength
-- progression, so there's no week-to-week variation to encode.
--
-- The source prescribes no fixed rest cadence, so intervalTimer/restTimer stay 0
-- (unused) and the user self-paces -- the same precedent DFW sets for its own
-- unused-timer sessions. Load is a single 24 kg placeholder (men's standard;
-- DFW's placeholder-load convention) so the program is runnable out of the box;
-- the user adjusts load per session in the builder at start time.

-- Session-local helper (pg_temp: auto-dropped at connection end, never persisted
-- to the committed schema) that builds the WorkoutOptions JSONB for one session.
-- Shape MUST match Omit<WorkoutOptions,'startedAt'> exactly (camelCase keys).
CREATE OR REPLACE FUNCTION pg_temp.swing10k_options(p_details TEXT)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'complexSet', false,
    'intervalTimer', 0,
    'restTimer', 0,
    'workoutGoal', 5,
    'workoutGoalUnits', 'rounds',
    'workoutDetails', p_details,
    'sharedWeightOneUnit', NULL,
    'sharedWeightOneValue', NULL,
    'sharedWeightTwoUnit', NULL,
    'sharedWeightTwoValue', NULL,
    'movements', jsonb_build_array(
      jsonb_build_object(
        'movementName', 'Kettlebell Swing',
        'repScheme', to_jsonb(ARRAY[10,15,25,50]::INT[]),
        'weightOneUnit', 'kilograms', 'weightOneValue', 24,
        'weightTwoUnit', NULL, 'weightTwoValue', NULL)
    ));
$$;

DO $$
DECLARE
  v_program_id UUID;
  v_week INT;
  v_day INT;
  v_seq INT := 0;
BEGIN
  INSERT INTO programs (owner_id, slug, title, description, author_name, num_weeks, days_per_week, is_public)
  VALUES (NULL, '10000-swing-challenge',
          '10,000 Swing Challenge',
          'Dan John''s 4-week conditioning challenge: 20 sessions of 500 kettlebell '
          'swings, performed as a 100-rep cluster (10/15/25/50) repeated 5 times.',
          'Dan John', 4, 5, true)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO v_program_id;

  -- If the row already existed, skip re-seeding sessions.
  IF v_program_id IS NULL THEN
    RAISE NOTICE '10,000 Swing Challenge program already seeded; skipping sessions.';
    RETURN;
  END IF;

  FOR v_week IN 1..4 LOOP
    FOR v_day IN 1..5 LOOP
      INSERT INTO program_sessions
        (program_id, sequence_index, week_number, day_number, title, workout_options)
      VALUES
        (v_program_id, v_seq, v_week, v_day,
         format('Week %s, Day %s', v_week, v_day),
         pg_temp.swing10k_options(
           format('Week %s, Day %s - 5 rounds of 10/15/25/50 (500 swings)', v_week, v_day)));
      v_seq := v_seq + 1;
    END LOOP;
  END LOOP;
END $$;
