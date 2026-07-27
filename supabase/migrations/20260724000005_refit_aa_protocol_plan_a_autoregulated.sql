-- Refit the StrongFirst "A+A Protocol, Plan A" template to its source's
-- autoregulated structure, as a single 4-week clean & jerk block (PROD-245).
-- Source: https://www.strongfirst.com/the-best-all-around-training-method-ever/
--
-- 20260723000001_reshape_aa_protocol_plan_a.sql fixed the cadence but modeled
-- duration as a fixed +2 min ramp (10 -> 30 over 8 weeks) and left the C+J ->
-- C+J+C -> C+J+C+J progression as prose. Found in live use (workout 1256,
-- W1D1): the athlete stopped at the 10-min goal feeling easy, when the source
-- says to carry on until the talk test fails. Corrected here:
--
--   1. Duration    Fixed ramp -> autoregulated. Every work session carries a
--                  30-min ceiling (workoutGoal 30) with a note stating the FULL
--                  rule: carry on until you cannot pass the talk test right
--                  before the next set; stop then, or at 30 min, whichever comes
--                  first. (The app needs workoutGoal > 0 to start and has no
--                  "no target" unit, so 30 min models the ceiling: the countdown
--                  auto-finishes = "whichever comes first"; the note governs the
--                  early stop.)
--   2. Note        The reshape's note stated only the "stop early" half. Now it
--                  states both halves ("carry on until ... stop then").
--   3. Structure   A single 4-week block: three build weeks + a deload week.
--                  The source progression (C+J -> C+J+C -> C+J+C+J) is milestone-
--                  gated ("repeat until you own 30 min, then escalate"), and the
--                  app has no queue/repeat/program-family primitive to sequence
--                  separate stages, so we ship the first stage (C+J) as a short
--                  block a user repeats. Repeating a 4-week block reproduces the
--                  source's every-4th-week deload for free. The later complexes
--                  live in the description as the next step, not as encoded
--                  sessions (escalating them is a future program-series feature).
--   4. Lifts       C+J is a single-arm complex of decomposed lifts (One-Arm
--                  Clean + One-Arm Jerk, no compound "Clean and Jerk"), so each
--                  lift is counted once for volume and cleans bucket to hinge /
--                  jerks to push.
--   5. Deloads     KEPT (source-accurate: "Every fourth week deload by going
--                  down a kettlebell size -4 kg per kettlebell for ladies, -8 kg
--                  for gentlemen"), the 4th week of the block, at the same 30-min
--                  ceiling one bell size lighter.
--
-- NB: pg_temp functions persist for the whole connection, and CI applies every
-- migration in one session, so these helpers are prefixed aa_refit_ to avoid
-- colliding with the identically-named-but-differently-signed pg_temp helpers
-- the reshape migration defines earlier in the same session (a same-signature,
-- different-parameter-name CREATE fails with SQLSTATE 42P13).
--
-- This is the app's first SINGLE-ARM complex: complexSet true with one-hand
-- movements (weightTwoValue 0) and intervalTimer 30, so each interval fire runs
-- the whole complex on one hand, then the other 30s later. The runtime support
-- for that (side-switch on a single-bell complex) ships alongside this migration
-- in src/pages/ActiveWorkoutPage.
--
--   Weeks 1-3   C+J  (Clean, Jerk)          work, 24 kg placeholder
--   Week  4     Deload C+J, one bell size lighter (24 -> 16 kg)
--
-- Forward DATA FIX over deployed rows (the original seed and the reshape are
-- applied in prod and ON CONFLICT DO NOTHING, so re-running them changes
-- nothing). Every statement is scoped to the SYSTEM-OWNED template
-- (slug = 'aa-protocol-plan-a' AND owner_id IS NULL). Copy-on-enroll clones carry
-- slug NULL and a real owner_id, so existing enrollees keep the program they
-- started, and deleting the template's sessions cascades no completions.

-- One decomposed lift in the complex: a single bell (weightTwoValue 0), one rep.
CREATE OR REPLACE FUNCTION pg_temp.aa_refit_mv(p_name TEXT, p_weight INT)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'movementName', p_name,
    'repScheme', to_jsonb(ARRAY[1]::INT[]),
    'weightOneUnit', 'kilograms', 'weightOneValue', p_weight,
    'weightTwoUnit', 'kilograms', 'weightTwoValue', 0);
$$;

-- The clean & jerk complex: one clean, one jerk, on a single bell.
CREATE OR REPLACE FUNCTION pg_temp.aa_refit_cj(p_weight INT)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_array(
    pg_temp.aa_refit_mv('One-Arm Kettlebell Clean', p_weight),
    pg_temp.aa_refit_mv('One-Arm Kettlebell Jerk', p_weight));
$$;

-- Full workout_options for one session. Shape MUST match
-- Omit<WorkoutOptions,'startedAt'> exactly (camelCase keys): single-bell complex
-- under EMOM, 30-min ceiling, notes under preWorkoutNotes.
CREATE OR REPLACE FUNCTION pg_temp.aa_refit_options(
  p_weight INT, p_details TEXT, p_movements JSONB
)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'complexSet', true,
    'intervalTimer', 30,
    'restTimer', 0,
    'workoutGoal', 30,
    'workoutGoalUnits', 'minutes',
    'preWorkoutNotes', p_details,
    'title', NULL,
    'sharedWeightOneUnit', 'kilograms',
    'sharedWeightOneValue', p_weight,
    'sharedWeightTwoUnit', 'kilograms',
    'sharedWeightTwoValue', 0,
    'movements', p_movements);
$$;

-- A working session at the placeholder 24 kg.
CREATE OR REPLACE FUNCTION pg_temp.aa_refit_work()
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT pg_temp.aa_refit_options(24,
    'Clean & jerk (C+J) - one bell, one set every 30s, alternating hands: left '
    'on the minute, right 30s later. Carry on until you cannot pass the talk '
    'test right before the next set; stop then, or at 30 min, whichever comes '
    'first. Once 30 min is repeatable with a clean talk test, progress by adding '
    'a second clean to each set (C+J+C).',
    pg_temp.aa_refit_cj(24));
$$;

-- The deload session: same clean & jerk one bell size lighter (24 -> 16 kg),
-- same 30s cadence and open-ended 30-min ceiling.
CREATE OR REPLACE FUNCTION pg_temp.aa_refit_deload()
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT pg_temp.aa_refit_options(16,
    'Deload week - one kettlebell size lighter (-8 kg gentlemen, -4 kg ladies), '
    'same clean & jerk and same 30s left/right cadence. Duration stays '
    'autoregulated: carry on until the talk test fails, up to 30 min. Explode, '
    'and keep it easy.',
    pg_temp.aa_refit_cj(16));
$$;

DO $$
DECLARE
  v_program_id       UUID;
  v_sessions_deleted INT;
  v_sessions_seeded  INT;
BEGIN
  SELECT id INTO v_program_id
  FROM programs
  WHERE slug = 'aa-protocol-plan-a' AND owner_id IS NULL;

  IF v_program_id IS NULL THEN
    RAISE NOTICE 'A+A Protocol template not found; nothing to refit.';
    RETURN;
  END IF;

  UPDATE programs
  SET num_weeks     = 4,
      days_per_week = 2,
      description =
        'A single-kettlebell alactic+aerobic conditioning protocol built on the '
        'one-arm clean & jerk. Every set is one bell on a 30-second interval - '
        'left hand on the minute, right hand 30 seconds later. Pick the bell you '
        'can clean & jerk 6-12 times with your WEAKER arm; long term the working '
        'weight settles near 40% of bodyweight for men. Train twice a week (the '
        'source prescribes Monday and Thursday). Duration is autoregulated, not '
        'scheduled: carry on until you cannot pass the talk test right before the '
        'next set - stop then, or at 30 minutes, whichever comes first. This is a '
        'four-week block: three build weeks and a deload week one kettlebell size '
        'lighter (-8 kg gentlemen, -4 kg ladies). Repeat the block until 30 '
        'minutes of clean & jerk is repeatable with a clean talk test, then '
        'progress by adding a second clean to each set (C+J+C), then a second '
        'jerk (C+J+C+J), up to three clean & jerks every 30 seconds.'
  WHERE id = v_program_id;

  DELETE FROM program_sessions WHERE program_id = v_program_id;
  GET DIAGNOSTICS v_sessions_deleted = ROW_COUNT;

  INSERT INTO program_sessions
    (program_id, sequence_index, week_number, day_number, title, workout_options)
  VALUES
    -- Weeks 1-3: work, C+J
    (v_program_id, 0, 1, 1, 'C+J',          pg_temp.aa_refit_work()),
    (v_program_id, 1, 1, 2, 'C+J',          pg_temp.aa_refit_work()),
    (v_program_id, 2, 2, 1, 'C+J',          pg_temp.aa_refit_work()),
    (v_program_id, 3, 2, 2, 'C+J',          pg_temp.aa_refit_work()),
    (v_program_id, 4, 3, 1, 'C+J',          pg_temp.aa_refit_work()),
    (v_program_id, 5, 3, 2, 'C+J',          pg_temp.aa_refit_work()),
    -- Week 4: deload
    (v_program_id, 6, 4, 1, 'Deload · C+J', pg_temp.aa_refit_deload()),
    (v_program_id, 7, 4, 2, 'Deload · C+J', pg_temp.aa_refit_deload());
  GET DIAGNOSTICS v_sessions_seeded = ROW_COUNT;

  -- Label the deload weight group so the enrollment picker shows "Deload weeks"
  -- rather than a derived "8 kg lighter" description. Keyed on the authored
  -- 16 kg deload load, mirroring 20260723160000_program_sessions_weight_label.sql
  -- (the DELETE above dropped that backfill's labels along with the old rows).
  UPDATE program_sessions ps
  SET weight_label = 'Deload weeks'
  WHERE ps.program_id = v_program_id
    AND (ps.workout_options->'movements'->0->>'weightOneValue')::NUMERIC = 16;

  RAISE NOTICE 'A+A Protocol refit: % sessions deleted, % seeded.',
    v_sessions_deleted, v_sessions_seeded;
END $$;
