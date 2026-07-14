-- Seed the shared StrongFirst "A+A Protocol, Plan A" program (PROD-153/PROD-229).
-- Public + system-owned (owner_id NULL, is_public true) so every user sees it and
-- can one-tap start it; enrolling clones it into an editable copy (enroll_in_program).
-- Idempotent on slug: a re-run (or a fresh env) skips re-seeding sessions.
--
-- This is a MIGRATION (not seed.sql) so it also reaches staging/production, where
-- seed.sql never runs. Runs as the migration role, which bypasses RLS, so the
-- NULL-owner public row inserts cleanly. Mirrors the DFW seed migration's
-- conventions (pg_temp helper -> WorkoutOptions JSONB matching
-- Omit<WorkoutOptions,'startedAt'> exactly, camelCase keys).
--
-- Source: StrongFirst's free "The Best All-Around Training Method Ever" A+A article
-- (the fully-disclosed free sibling to the paid Iron Cardio). Single-KB one-arm
-- clean & jerk, EMOM-style: left arm on the minute, right arm 30s later, over a
-- fixed duration that grows across a 4-stage progression, 2-3x/wk with a monthly
-- deload.
--
-- ── First real use of intervalTimer ─────────────────────────────────────────
-- DFW leaves intervalTimer at 0 in every session; this program is defined by it.
-- In ActiveWorkoutPage.tsx the interval countdown auto-fires "continue" (with a
-- ding) every `intervalTimer` seconds (finishInterval, lines ~315/407-413), and
-- each continue completes exactly one SIDE of work. Because the one-arm clean &
-- jerk is modeled one-handed (weightOne set, weightTwo = 0 -> isOneHanded ->
-- shouldMirrorReps), consecutive fires alternate left/right. So intervalTimer = 30
-- reproduces the source cadence precisely: left arm at 0:00, right arm at 0:30,
-- left at 1:00, ... a full left+right cycle every 60s. restTimer stays 0 (the
-- EMOM interval IS the pacing; there is no separate between-set rest here).
--
-- ── 4-stage progression (workout_details spell out the numbers) ─────────────
-- Modeled as workoutGoalUnits='minutes' with the goal growing ~quarterly toward
-- 30 min: Stage 1 = 8, Stage 2 = 15, Stage 3 = 22, Stage 4 = 30. Load is a single
-- 24 kg placeholder (men's standard; user overrides at start). repScheme=[1] = one
-- clean & jerk per arm per 30s slot. A monthly deload session (seq 4) drops both
-- load (20 kg) and duration (15 min).

-- Session-local helper (pg_temp: auto-dropped at connection end, never persisted
-- to the committed schema) that builds the WorkoutOptions JSONB for each session.
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

DO $$
DECLARE
  v_program_id UUID;
BEGIN
  INSERT INTO programs (owner_id, slug, title, description, author_name, num_weeks, days_per_week, is_public)
  VALUES (NULL, 'aa-protocol-plan-a',
          'A+A Protocol "Plan A"',
          'A single-kettlebell alactic+aerobic conditioning protocol built on the '
          'one-arm clean & jerk, paced EMOM-style (left arm on the minute, right arm '
          '30 seconds later) over a duration that grows across four stages toward '
          '30 minutes, trained 2-3x per week with a monthly deload.',
          'Pavel Tsatsouline / StrongFirst', 4, 3, true)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO v_program_id;

  -- If the row already existed, skip re-seeding sessions.
  IF v_program_id IS NULL THEN
    RAISE NOTICE 'A+A Protocol program already seeded; skipping sessions.';
    RETURN;
  END IF;

  INSERT INTO program_sessions
    (program_id, sequence_index, week_number, day_number, title, workout_options)
  VALUES
    (v_program_id, 0, 1, 1, 'Stage 1 - 8 min',
       pg_temp.aa_options(8,  24, 'A+A Plan A Stage 1 - 8 min of one-arm clean & jerk, 24 kg. Left arm on the minute, right arm 30s later (30s cadence).')),
    (v_program_id, 1, 2, 1, 'Stage 2 - 15 min',
       pg_temp.aa_options(15, 24, 'A+A Plan A Stage 2 - 15 min of one-arm clean & jerk, 24 kg. Same 30s left/right cadence; hold power output as the clock grows.')),
    (v_program_id, 2, 3, 1, 'Stage 3 - 22 min',
       pg_temp.aa_options(22, 24, 'A+A Plan A Stage 3 - 22 min of one-arm clean & jerk, 24 kg. Same 30s left/right cadence; stay crisp and unhurried.')),
    (v_program_id, 3, 4, 1, 'Stage 4 - 30 min',
       pg_temp.aa_options(30, 24, 'A+A Plan A Stage 4 - the full 30 min of one-arm clean & jerk, 24 kg. Same 30s left/right cadence; this is the target session.')),
    (v_program_id, 4, 4, 2, 'Monthly deload',
       pg_temp.aa_options(15, 20, 'A+A Plan A monthly deload - lighter and shorter: 15 min at 20 kg. Same 30s left/right cadence; keep it easy and restorative.'));
END $$;
