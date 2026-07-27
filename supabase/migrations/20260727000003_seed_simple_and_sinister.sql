-- Seed the shared "Simple & Sinister" program (Pavel Tsatsouline, StrongFirst).
-- Public + system-owned (owner_id NULL, is_public true) so every user sees it and
-- can one-tap "Start"; enrolling clones it into an editable copy (enroll_in_program).
-- Idempotent on slug: a re-run (or fresh env) skips re-seeding. This is a MIGRATION
-- (not seed.sql) so it also reaches staging/production, where seed.sql never runs.
--
-- Source: https://www.strongfirst.com/achieve/sinister/ -- the S&S protocol is free
-- and ubiquitous. It is the single most-followed beginner kettlebell program, and
-- the first REPEATING WORKOUT in the catalog: default_auto_repeat = true, so finishing
-- it loops back to the same session rather than flipping to "complete". Progress is
-- added load over weeks (Timeless Simple -> Simple 32 kg -> Sinister 48 kg), not
-- advancing through sessions -- exactly what the auto-repeat toggle models.
--
-- THE WORKOUT (one session, done most days):
--   * 100 one-arm swings: 5 rungs of 10, single-bell one-handed (weightTwoValue 0
--     => '1h' mode), so the runtime MIRRORS each rung per hand -> 10 L + 10 R x 5 =
--     100 swings, 50 per side.
--   * 10 Turkish get-ups: 5 rungs of 1, likewise mirrored -> 1 L + 1 R x 5 = 10
--     get-ups, 5 per side.
--   * straightSets = true: every swing rung is completed before the get-ups begin
--     (all swings, then all get-ups), matching how S&S is performed.
--
-- MODELING DECISIONS:
--   * ROUNDS goal of 1: one round = the whole ladder once (all swings + all get-ups).
--     Mirrors Easy Strength -- the repScheme already encodes every set, so a single
--     round is a complete session.
--   * NO EMOM. The "Timeless Simple" on-ramp is done for quality with rest as needed,
--     not on the minute (intervalTimer 0). The 5-minute swing / 10-minute get-up
--     pace of the "Simple"/"Sinister" standards is a benchmark the lifter grows into,
--     noted in preWorkoutNotes rather than enforced by a timer.
--   * 24 kg is a PLACEHOLDER, as in every seed; the enrollment weight picker pre-fills
--     single-bell and the user sets their own load (Pavel's beginner start is 16 kg
--     women / 24 kg men, working toward the 32 kg "Simple" standard).
--   * NO FIXED CADENCE. num_weeks / days_per_week are NULL: a repeating workout has no
--     finish line, so cadence is left blank and the UI shows it as a repeating workout.

-- One single-bell, one-handed movement object (weightTwoValue 0 => mirror per hand).
CREATE OR REPLACE FUNCTION pg_temp.ss_movement(p_name TEXT, p_reps INT[])
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'movementName', p_name,
    'repScheme', to_jsonb(p_reps),
    'weightOneUnit', 'kilograms', 'weightOneValue', 24,
    'weightTwoUnit', NULL, 'weightTwoValue', 0);
$$;

DO $$
DECLARE
  v_program_id UUID;
BEGIN
  INSERT INTO programs (owner_id, slug, title, description, author_name,
                        num_weeks, days_per_week, is_public, default_auto_repeat)
  VALUES (NULL, 'simple-and-sinister',
          'Simple & Sinister',
          'Two movements, done most days, forever: 100 one-arm swings and 10 '
          'Turkish get-ups. The most-followed beginner kettlebell program -- built '
          'to give the greatest return from the fewest exercises. You do not '
          'progress by changing the workout; you progress by adding weight. Repeats '
          'automatically.',
          'Pavel Tsatsouline (StrongFirst)', NULL, NULL, true, true)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO v_program_id;

  -- If the row already existed, skip re-seeding sessions.
  IF v_program_id IS NULL THEN
    RAISE NOTICE 'Simple & Sinister program already seeded; skipping sessions.';
    RETURN;
  END IF;

  -- One session, two movements, run straight-sets (all swings, then all get-ups).
  -- Both movements are single-bell one-handed (weightTwoValue 0), so the runtime
  -- mirrors each rung per hand: 5x10 swings -> 100 total, 5x1 get-ups -> 10 total.
  INSERT INTO program_sessions
    (program_id, sequence_index, week_number, day_number, title, workout_options)
  VALUES
    (v_program_id, 0, 1, 1, '100 swings + 10 get-ups',
     jsonb_build_object(
       'complexSet', false,
       'straightSets', true,
       'intervalTimer', 0,
       'restTimer', 0,
       'workoutGoal', 1,
       'workoutGoalUnits', 'rounds',
       'title', NULL,
       'preWorkoutNotes',
         '100 one-arm swings (10 per hand x 5), then 10 Turkish get-ups (5 per hand). '
         'Swings in sets of 10 for power, get-ups as singles for perfect technique. '
         'Rest as needed and keep every rep crisp -- this is built for quality, not a '
         'race. Progress by adding weight, not reps: work toward doing it with a 32 kg '
         'bell (the "Simple" standard). Start around 16 kg (women) / 24 kg (men).',
       'sharedWeightOneUnit', NULL,
       'sharedWeightOneValue', NULL,
       'sharedWeightTwoUnit', NULL,
       'sharedWeightTwoValue', NULL,
       'movements', jsonb_build_array(
         pg_temp.ss_movement('One-Arm Kettlebell Swing', ARRAY[10,10,10,10,10]::INT[]),
         pg_temp.ss_movement('Kettlebell Turkish Get-Up', ARRAY[1,1,1,1,1]::INT[])
       )));
END $$;
