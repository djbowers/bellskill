-- Seed the shared "Easy Strength" program (Dan John, concept co-credited to
-- Pavel), modeled as the fixed 10-workout / 2-week "Even Easier Strength" cycle.
-- Public + system-owned (owner_id NULL, is_public true) so every user sees it
-- and can one-tap "Start Easy Strength"; enrolling clones it into an editable
-- copy (enroll_in_program). Idempotent on slug: a re-run (or a fresh env) skips
-- re-seeding sessions. Mirrors the DFW seed migration's conventions
-- (20260706170001_seed_dry_fighting_weight.sql).
--
-- Runs as the migration role, which bypasses RLS, so the NULL-owner public row
-- inserts cleanly. This is a MIGRATION (not seed.sql) so it also reaches
-- staging/production, where seed.sql never runs.
--
-- 10 trackable sessions (seq 0-9), five each across two weeks. Every session runs
-- the same 5 movement patterns (press / pull / hinge / squat / carry) alternated
-- rung-by-rung (complexSet false, like DFW). Only the shared rep scheme and the
-- session notes change day to day; the "Even Easier Strength" set/rep cycle is:
--   Week A: 2x5, 2x5, 5-3-2, 2x5, 2x5
--   Week B: 2x5, 6x1 (ascending), 1x10, 2x5, 5-3-1
--
-- workoutGoalUnits is 'rounds' with the goal = number of rungs (repScheme length),
-- so one full cycle through all five movements = one round (ladder-style, matching
-- how the runtime advances the shared rung index).
--
-- Movement -> catalog weight mode (see src/utils/movementWeightModeFilter.ts):
--   * Press  Two-Arm Kettlebell Military Press  -> double bells (weightOne+weightTwo)
--   * Pull   Pull-Up                            -> bodyweight (all weights NULL => 'none')
--   * Hinge  Kettlebell Swing                   -> single bell, two-hand (weightTwo NULL => '2h')
--   * Squat  Front Squat With Two Kettlebells   -> double bells
--   * Carry  Kettlebell Farmer's Carry          -> double bells
-- Load defaults are 24 kg placeholders so the program is runnable out of the box;
-- the user adjusts load per session in the builder at start time.
--
-- KNOWN, DELIBERATE APPROXIMATION (Week B Day 2 / seq 6, "6x1 add weight each set"):
-- the source ramps load up across the six singles, but WorkoutOptions holds one
-- fixed weight per movement per session -- there is no in-session weight ramp. So
-- this day is seeded with the flat 24 kg placeholder and workoutDetails that tell
-- the user to add weight manually on each of the six singles. This is the same
-- workaround DFW itself uses for autoregulated days; see PROD-230 / PROD-225 and
-- data/research-kb-programs-r3/report.md -- it is resolved as the right call, not
-- a gap to fix here.

-- Session-local helper (pg_temp: auto-dropped at connection end, never persisted
-- to the committed schema) that builds the WorkoutOptions JSONB for one session.
-- Shape MUST match Omit<WorkoutOptions,'startedAt'> exactly (camelCase keys).
CREATE OR REPLACE FUNCTION pg_temp.es_options(p_reps INT[], p_details TEXT)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'complexSet', false,
    'intervalTimer', 0,
    'restTimer', 0,
    'workoutGoal', array_length(p_reps, 1),
    'workoutGoalUnits', 'rounds',
    'workoutDetails', p_details,
    'sharedWeightOneUnit', NULL,
    'sharedWeightOneValue', NULL,
    'sharedWeightTwoUnit', NULL,
    'sharedWeightTwoValue', NULL,
    'movements', jsonb_build_array(
      jsonb_build_object(
        'movementName', 'Two-Arm Kettlebell Military Press',
        'repScheme', to_jsonb(p_reps),
        'weightOneUnit', 'kilograms', 'weightOneValue', 24,
        'weightTwoUnit', 'kilograms', 'weightTwoValue', 24),
      jsonb_build_object(
        'movementName', 'Pull-Up',
        'repScheme', to_jsonb(p_reps),
        'weightOneUnit', NULL, 'weightOneValue', NULL,
        'weightTwoUnit', NULL, 'weightTwoValue', NULL),
      jsonb_build_object(
        'movementName', 'Kettlebell Swing',
        'repScheme', to_jsonb(p_reps),
        'weightOneUnit', 'kilograms', 'weightOneValue', 24,
        'weightTwoUnit', NULL, 'weightTwoValue', NULL),
      jsonb_build_object(
        'movementName', 'Front Squat With Two Kettlebells',
        'repScheme', to_jsonb(p_reps),
        'weightOneUnit', 'kilograms', 'weightOneValue', 24,
        'weightTwoUnit', 'kilograms', 'weightTwoValue', 24),
      jsonb_build_object(
        'movementName', 'Kettlebell Farmer''s Carry',
        'repScheme', to_jsonb(p_reps),
        'weightOneUnit', 'kilograms', 'weightOneValue', 24,
        'weightTwoUnit', 'kilograms', 'weightTwoValue', 24)
    ));
$$;

DO $$
DECLARE
  v_program_id UUID;
BEGIN
  INSERT INTO programs (owner_id, slug, title, description, author_name, num_weeks, days_per_week, is_public)
  VALUES (NULL, 'easy-strength',
          'Easy Strength',
          'Dan John''s basic full-body strength template: five movement patterns '
          '(press, pull, hinge, squat, carry) trained daily on a fixed 10-workout, '
          '2-week "Even Easier Strength" set/rep cycle. Grease the groove, never grind.',
          'Dan John', 2, 5, true)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO v_program_id;

  -- If the row already existed, skip re-seeding sessions.
  IF v_program_id IS NULL THEN
    RAISE NOTICE 'Easy Strength program already seeded; skipping sessions.';
    RETURN;
  END IF;

  INSERT INTO program_sessions
    (program_id, sequence_index, week_number, day_number, title, workout_options)
  VALUES
    (v_program_id, 0, 1, 1, '2x5',   pg_temp.es_options(ARRAY[5,5]::INT[],       'Easy Strength W1D1 - 2 sets of 5 per movement. Keep it easy; leave reps in the tank.')),
    (v_program_id, 1, 1, 2, '2x5',   pg_temp.es_options(ARRAY[5,5]::INT[],       'Easy Strength W1D2 - 2 sets of 5 per movement.')),
    (v_program_id, 2, 1, 3, '5-3-2', pg_temp.es_options(ARRAY[5,3,2]::INT[],     'Easy Strength W1D3 - 5, 3, then 2 reps per movement (drop reps, you may nudge load up).')),
    (v_program_id, 3, 1, 4, '2x5',   pg_temp.es_options(ARRAY[5,5]::INT[],       'Easy Strength W1D4 - 2 sets of 5 per movement.')),
    (v_program_id, 4, 1, 5, '2x5',   pg_temp.es_options(ARRAY[5,5]::INT[],       'Easy Strength W1D5 - 2 sets of 5 per movement.')),
    (v_program_id, 5, 2, 1, '2x5',   pg_temp.es_options(ARRAY[5,5]::INT[],       'Easy Strength W2D1 - 2 sets of 5 per movement.')),
    (v_program_id, 6, 2, 2, '6x1 (ascending load)',
                                     pg_temp.es_options(ARRAY[1,1,1,1,1,1]::INT[],
                                       'Easy Strength W2D2 - 6 heavy singles per movement, ADDING WEIGHT each single (never miss a rep). '
                                       'The app holds one fixed weight per movement per session, so the seeded 24 kg is only a starting '
                                       'placeholder - manually increase the load before each of the six singles.')),
    (v_program_id, 7, 2, 3, '1x10',  pg_temp.es_options(ARRAY[10]::INT[],        'Easy Strength W2D3 - 1 set of 10 reps per movement (lighter, higher-rep day).')),
    (v_program_id, 8, 2, 4, '2x5',   pg_temp.es_options(ARRAY[5,5]::INT[],       'Easy Strength W2D4 - 2 sets of 5 per movement.')),
    (v_program_id, 9, 2, 5, '5-3-1', pg_temp.es_options(ARRAY[5,3,1]::INT[],     'Easy Strength W2D5 - 5, 3, then 1 rep per movement (work up to a heavy single).'));
END $$;
