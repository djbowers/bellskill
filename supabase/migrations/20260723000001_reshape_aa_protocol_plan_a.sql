-- Reshape the seeded StrongFirst "A+A Protocol, Plan A" program to match its
-- source: https://www.strongfirst.com/the-best-all-around-training-method-ever/
--
-- 20260713181819_seed_aa_protocol_plan_a.sql shipped a program that advertised
-- days_per_week=3 / "2-3x per week" but laid its five sessions out one per week
-- (W1D1, W2D1, W3D1, W4D1, W4D2), and diverged from the source in five more
-- ways. Corrected here:
--
--   1. Cadence      3x/wk (and really 1x/wk) -> "Train twice a week, on Mondays
--                   and Thursdays": 8 weeks x 2 days = 16 sessions.
--   2. Progression   4 invented stages (8/15/22/30) -> a duration ramp toward
--                   the source's 30 min / 30 sets per arm target, +2 min per
--                   session. Volume is talk-test autoregulated in the source;
--                   the ramp is the trackable modeling of it, and the details
--                   tell the athlete to stop early when the talk test fails.
--   3. Deload week  A single shortened 15-min session -> the WHOLE fourth week
--                   (weeks 4 and 8), at the previous week's duration, per
--                   "maintaining the rest of the load parameters of the last
--                   training session (the same sets, reps, and rest periods)".
--   4. Deload load  24 -> 20 kg (a 4 kg ladies' step) -> 24 -> 16 kg, per
--                   "-4kg per kettlebell for ladies, -8kg for gentlemen".
--   5. Load choice  "24 kg (men's standard)" -> the 6-12RM on the WEAKER arm,
--                   which is what the source has you test for. 24 kg stays the
--                   placeholder the enrollee overrides at start.
--   6. Rep density  The source's post-30-min progression (C+J -> C+J+C ->
--                   C+J+C+J, up to three C&J per 30s) is described in the
--                   program description rather than modeled as more sessions;
--                   every seeded session stays at repScheme [1].
--
-- Unchanged and still correct: intervalTimer 30 with a one-handed movement, so
-- consecutive auto-fires alternate arms -- left on the minute, right 30s later.
--
-- This is a forward DATA FIX over deployed rows (the original seed is applied
-- in production and is ON CONFLICT DO NOTHING, so re-running it changes
-- nothing). Modeled on 20260720150000_rename_front_squat_double_kb.sql:
-- guarded, idempotent, RAISE NOTICE row counts for the post-merge prod check.
--
-- Every statement is scoped to the SYSTEM-OWNED template
-- (slug = 'aa-protocol-plan-a' AND owner_id IS NULL). Copy-on-enroll clones
-- carry slug NULL and a real owner_id, so existing enrollees keep the program
-- they started, and deleting the template's sessions cascades no completions
-- (completions point at the enrollee's cloned session rows, never these).

-- Session-local helper (pg_temp: auto-dropped at connection end, never
-- persisted to the committed schema). Shape MUST match
-- Omit<WorkoutOptions,'startedAt'> exactly (camelCase keys), matching the
-- original seed's helper.
CREATE OR REPLACE FUNCTION pg_temp.aa_options(
  p_minutes INT, p_weight INT, p_details TEXT
)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'complexSet', false,
    'intervalTimer', 30,
    'restTimer', 0,
    'workoutGoal', p_minutes,
    'workoutGoalUnits', 'minutes',
    'workoutDetails', p_details,
    'sharedWeightOneUnit', NULL,
    'sharedWeightOneValue', NULL,
    'sharedWeightTwoUnit', NULL,
    'sharedWeightTwoValue', NULL,
    'movements', jsonb_build_array(
      jsonb_build_object(
        'movementName', 'One-Arm Kettlebell Clean and Jerk',
        'repScheme', to_jsonb(ARRAY[1]::INT[]),
        'weightOneUnit', 'kilograms', 'weightOneValue', p_weight,
        'weightTwoUnit', 'kilograms', 'weightTwoValue', 0)
    ));
$$;

-- A working session: the ramp toward 30 minutes at the placeholder load.
CREATE OR REPLACE FUNCTION pg_temp.aa_work(p_minutes INT)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT pg_temp.aa_options(p_minutes, 24, format(
    '%s min of one-arm clean & jerk. One set every 30s: left arm on the minute, '
    'right arm 30s later. Stop early any time you cannot pass the talk test '
    'right before the next set.', p_minutes));
$$;

-- A deload session: same duration as the week before, one bell size lighter.
CREATE OR REPLACE FUNCTION pg_temp.aa_deload(p_minutes INT)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT pg_temp.aa_options(p_minutes, 16, format(
    'Deload week - %s min, one kettlebell size lighter (-8 kg gentlemen, -4 kg '
    'ladies) with every other parameter held: same 30s left/right cadence, same '
    'duration as last week. Explode, and keep it easy.', p_minutes));
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
    RAISE NOTICE 'A+A Protocol template not found; nothing to reshape.';
    RETURN;
  END IF;

  UPDATE programs
  SET num_weeks   = 8,
      days_per_week = 2,
      description =
        'A single-kettlebell alactic+aerobic conditioning protocol built on the '
        'one-arm clean & jerk. One set every 30 seconds - left arm on the '
        'minute, right arm 30 seconds later - with the bell you can clean & '
        'jerk 6-12 times with your WEAKER arm. Train twice a week (the source '
        'prescribes Monday and Thursday), building from 10 up to 30 minutes of '
        'work across eight weeks, with every fourth week deloaded one bell size '
        'lighter at the same duration. Cut any session short when you cannot '
        'pass the talk test before the next set. Once 30 minutes feels strong, '
        'repeat the block adding a second clean to each set (C+J+C), then a '
        'second jerk (C+J+C+J), up to three clean & jerks every 30 seconds.'
  WHERE id = v_program_id;

  DELETE FROM program_sessions WHERE program_id = v_program_id;
  GET DIAGNOSTICS v_sessions_deleted = ROW_COUNT;

  -- Weeks 1-3 and 5-7 ramp +2 min per session toward the 30-minute target;
  -- weeks 4 and 8 hold the preceding week's final duration at the lighter bell.
  INSERT INTO program_sessions
    (program_id, sequence_index, week_number, day_number, title, workout_options)
  VALUES
    (v_program_id,  0, 1, 1, '10 min',          pg_temp.aa_work(10)),
    (v_program_id,  1, 1, 2, '12 min',          pg_temp.aa_work(12)),
    (v_program_id,  2, 2, 1, '14 min',          pg_temp.aa_work(14)),
    (v_program_id,  3, 2, 2, '16 min',          pg_temp.aa_work(16)),
    (v_program_id,  4, 3, 1, '18 min',          pg_temp.aa_work(18)),
    (v_program_id,  5, 3, 2, '20 min',          pg_temp.aa_work(20)),
    (v_program_id,  6, 4, 1, 'Deload - 20 min', pg_temp.aa_deload(20)),
    (v_program_id,  7, 4, 2, 'Deload - 20 min', pg_temp.aa_deload(20)),
    (v_program_id,  8, 5, 1, '22 min',          pg_temp.aa_work(22)),
    (v_program_id,  9, 5, 2, '24 min',          pg_temp.aa_work(24)),
    (v_program_id, 10, 6, 1, '26 min',          pg_temp.aa_work(26)),
    (v_program_id, 11, 6, 2, '28 min',          pg_temp.aa_work(28)),
    (v_program_id, 12, 7, 1, '30 min',          pg_temp.aa_work(30)),
    (v_program_id, 13, 7, 2, '30 min',          pg_temp.aa_work(30)),
    (v_program_id, 14, 8, 1, 'Deload - 30 min', pg_temp.aa_deload(30)),
    (v_program_id, 15, 8, 2, 'Deload - 30 min', pg_temp.aa_deload(30));
  GET DIAGNOSTICS v_sessions_seeded = ROW_COUNT;

  RAISE NOTICE 'A+A Protocol reshaped: % sessions deleted, % seeded.',
    v_sessions_deleted, v_sessions_seeded;
END $$;
