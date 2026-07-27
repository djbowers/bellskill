-- Seed the shared "Onnit Beginner Full-Body" program. Public + system-owned
-- (owner_id NULL, is_public true); enrolling clones it (enroll_in_program).
-- Idempotent on slug. MIGRATION (not seed.sql) so it reaches staging/production.
--
-- Source: https://www.onnit.com/blogs/the-edge/full-body-kettlebell-workout-for-beginners
-- A 3-round full-body circuit run up to 3x/week -- one of the most widely shared free
-- beginner routines. Like Simple & Sinister it is a REPEATING WORKOUT
-- (default_auto_repeat = true): the routine is published with no week-to-week
-- progression, so finishing loops back to the same circuit rather than "completing".
--
-- THE WORKOUT (one session, a circuit): rotate through the movements once per round
-- (straightSets false, complexSet false), 3 rounds (workoutGoal 3). 16 kg placeholder
-- (Onnit recommends 8 kg women / 16 kg men).
--
-- CATALOG MAPPING -- "map to closest, drop hip-pass". Onnit's exact movement names
-- are not all in the catalog, so a few are mapped to the nearest existing movement
-- (movementName must match scripts/data/movements.csv exactly). These substitutions
-- change the movement label, not the training intent:
--   Onnit "Goblet Squat"          -> Goblet Squat (exact)
--   Onnit "Split-Stance Row"      -> One-Arm Kettlebell Row (catalog's only 1-arm row)
--   Onnit "Strict Press"          -> One-Arm Kettlebell Military Press
--   Onnit "Chest-Loaded Swing"    -> Kettlebell Swing (the two swing blocks in the
--                                    published circuit are folded into this one entry)
--   Onnit "Shoulder Halo"         -> Kettlebell Halo (exact intent)
--   Onnit "Figure-8"              -> Kettlebell Figure 8
--   Onnit "Hip Pass"              -> DROPPED (no catalog equivalent)
--
-- WEIGHT MODES: goblet squat / swing / halo / figure-8 are two-handed on one bell
-- (weightTwoValue NULL => '2h'); the row and press are one-handed (weightTwoValue 0
-- => '1h'), so the runtime mirrors each per hand -- matching Onnit's "each side".

-- One movement object at the 16 kg placeholder. p_weight_two = 0 marks a one-handed
-- (mirrored) movement; NULL marks a two-handed single-bell movement.
CREATE OR REPLACE FUNCTION pg_temp.onnit_movement(p_name TEXT, p_reps INT[], p_weight_two INT)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'movementName', p_name,
    'repScheme', to_jsonb(p_reps),
    'weightOneUnit', 'kilograms', 'weightOneValue', 16,
    'weightTwoUnit', NULL, 'weightTwoValue', p_weight_two);
$$;

DO $$
DECLARE
  v_program_id UUID;
BEGIN
  INSERT INTO programs (owner_id, slug, title, description, author_name,
                        num_weeks, days_per_week, is_public, default_auto_repeat)
  VALUES (NULL, 'onnit-beginner-full-body',
          'Onnit Beginner Full-Body',
          'A full-body kettlebell circuit for your first month: goblet squat, row, '
          'press, swing, halo, and figure-8, done as a 3-round circuit up to three '
          'times a week. One light bell, every major movement pattern. Repeats '
          'automatically.',
          'Onnit', NULL, NULL, true, true)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO v_program_id;

  -- If the row already existed, skip re-seeding sessions.
  IF v_program_id IS NULL THEN
    RAISE NOTICE 'Onnit Beginner Full-Body program already seeded; skipping sessions.';
    RETURN;
  END IF;

  INSERT INTO program_sessions
    (program_id, sequence_index, week_number, day_number, title, workout_options)
  VALUES
    (v_program_id, 0, 1, 1, '3-round circuit',
     jsonb_build_object(
       'complexSet', false,
       'straightSets', false,
       'intervalTimer', 0,
       'restTimer', 0,
       'workoutGoal', 3,
       'workoutGoalUnits', 'rounds',
       'title', NULL,
       'preWorkoutNotes',
         'Do one set of each movement in order, without resting in between, then '
         'rest 1-2 minutes and repeat -- 3 rounds total. Row and press are per hand. '
         'Keep it light and smooth; this is a first-month full-body circuit, not a '
         'grind. Onnit recommends an 8 kg (women) / 16 kg (men) bell to start.',
       'sharedWeightOneUnit', NULL,
       'sharedWeightOneValue', NULL,
       'sharedWeightTwoUnit', NULL,
       'sharedWeightTwoValue', NULL,
       'movements', jsonb_build_array(
         pg_temp.onnit_movement('Goblet Squat', ARRAY[10]::INT[], NULL),
         pg_temp.onnit_movement('One-Arm Kettlebell Row', ARRAY[8]::INT[], 0),
         pg_temp.onnit_movement('One-Arm Kettlebell Military Press', ARRAY[5]::INT[], 0),
         pg_temp.onnit_movement('Kettlebell Swing', ARRAY[15]::INT[], NULL),
         pg_temp.onnit_movement('Kettlebell Halo', ARRAY[8]::INT[], NULL),
         pg_temp.onnit_movement('Kettlebell Figure 8', ARRAY[5]::INT[], NULL)
       )));
END $$;
