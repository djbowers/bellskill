-- Refit the StrongFirst "A+A Protocol, Plan A" template to its source's
-- autoregulated, milestone-based structure (PROD-245).
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
--   3. Progression Milestone stages, not a calendar ramp. The C+J -> C+J+C ->
--                  C+J+C+J milestones ARE the session progression (see mapping
--                  below), each a single-arm complex so per-lift volume is exact.
--   4. Lifts       Fully decomposed into One-Arm Clean + One-Arm Jerk (no
--                  compound "Clean and Jerk"), so each lift is counted once and
--                  cleans bucket to hinge / jerks to push. Volume grows 2 -> 3
--                  -> 4x the bell across the stages.
--   5. Deloads     KEPT (source-accurate: "Every fourth week deload by going
--                  down a kettlebell size -4 kg per kettlebell for ladies, -8 kg
--                  for gentlemen"), but refit to the same 30-min ceiling instead
--                  of the reshape's fixed 20/30-min holds.
--
-- NB: pg_temp functions persist for the whole connection, and CI applies every
-- migration in one session, so these helpers are prefixed aa_refit_ to avoid
-- colliding with the identically-named-but-differently-signed pg_temp helpers
-- the reshape migration defines earlier in the same session (a same-signature,
-- different-parameter-name CREATE fails with SQLSTATE 42P13).
--
-- These sessions are the app's first SINGLE-ARM complexes: complexSet true with
-- one-hand movements (weightTwoValue 0) and intervalTimer 30, so each interval
-- fire runs the whole complex on one hand, then the other 30s later. The runtime
-- support for that (side-switch on a single-bell complex) ships alongside this
-- migration in src/pages/ActiveWorkoutPage.
--
-- Milestone -> program_sessions mapping (12 weeks x 2 days = 24 sessions;
-- deload every 4th week per the source). Because the schema has no per-enrollment
-- "advance when ready" state, the 12-week calendar is a REPRESENTATIVE scaffold:
-- the notes tell the athlete progression is milestone-gated (repeat a stage until
-- 30 min is repeatable with a clean talk test), not calendar-gated. Modeling that
-- mutable per-enrollment stage state is deferred to PROD-243 ("don't solve it
-- twice").
--   Weeks 1-3   Stage 1  C+J        (Clean, Jerk)
--   Week  4     Deload   Stage 1, one bell size lighter
--   Weeks 5-7   Stage 2  C+J+C      (Clean, Jerk, Clean)
--   Week  8     Deload   Stage 2, one bell size lighter
--   Weeks 9-11  Stage 3  C+J+C+J    (Clean, Jerk, Clean, Jerk)
--   Week  12    Deload   Stage 3, one bell size lighter
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

-- The ordered complex for a stage: C+J, C+J+C, or C+J+C+J.
CREATE OR REPLACE FUNCTION pg_temp.aa_refit_stage_movements(p_stage INT, p_weight INT)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_stage
    WHEN 1 THEN jsonb_build_array(
      pg_temp.aa_refit_mv('One-Arm Kettlebell Clean', p_weight),
      pg_temp.aa_refit_mv('One-Arm Kettlebell Jerk', p_weight))
    WHEN 2 THEN jsonb_build_array(
      pg_temp.aa_refit_mv('One-Arm Kettlebell Clean', p_weight),
      pg_temp.aa_refit_mv('One-Arm Kettlebell Jerk', p_weight),
      pg_temp.aa_refit_mv('One-Arm Kettlebell Clean', p_weight))
    ELSE jsonb_build_array(
      pg_temp.aa_refit_mv('One-Arm Kettlebell Clean', p_weight),
      pg_temp.aa_refit_mv('One-Arm Kettlebell Jerk', p_weight),
      pg_temp.aa_refit_mv('One-Arm Kettlebell Clean', p_weight),
      pg_temp.aa_refit_mv('One-Arm Kettlebell Jerk', p_weight))
  END;
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

-- A working session at the placeholder 24 kg for the given stage.
CREATE OR REPLACE FUNCTION pg_temp.aa_refit_work(p_stage INT)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT pg_temp.aa_refit_options(24, CASE p_stage
    WHEN 1 THEN
      'Stage 1 - clean & jerk (C+J). One set every 30s, alternating hands: '
      'left on the minute, right 30s later. Carry on until you cannot pass the '
      'talk test right before the next set; stop then, or at 30 min, whichever '
      'comes first. Repeat this stage until 30 min is repeatable with a clean '
      'talk test, then advance to Stage 2 by adding a second clean (C+J+C).'
    WHEN 2 THEN
      'Stage 2 - clean, jerk, clean (C+J+C). One set every 30s, alternating '
      'hands: left on the minute, right 30s later. Carry on until you cannot '
      'pass the talk test right before the next set; stop then, or at 30 min, '
      'whichever comes first. Repeat this stage until 30 min is repeatable with '
      'a clean talk test, then advance to Stage 3 by adding a second jerk '
      '(C+J+C+J).'
    ELSE
      'Stage 3 - clean, jerk, clean, jerk (C+J+C+J). One set every 30s, '
      'alternating hands: left on the minute, right 30s later. Carry on until '
      'you cannot pass the talk test right before the next set; stop then, or at '
      '30 min, whichever comes first. Keep building toward three clean & jerks '
      'every 30s.'
  END, pg_temp.aa_refit_stage_movements(p_stage, 24));
$$;

-- A deload session: the same stage complex one bell size lighter (24 -> 16 kg),
-- same 30s cadence and open-ended 30-min ceiling.
CREATE OR REPLACE FUNCTION pg_temp.aa_refit_deload(p_stage INT)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT pg_temp.aa_refit_options(16,
    'Deload week - one kettlebell size lighter (-8 kg gentlemen, -4 kg ladies), '
    'same complex and same 30s left/right cadence. Duration stays autoregulated: '
    'carry on until the talk test fails, up to 30 min. Explode, and keep it easy.',
    pg_temp.aa_refit_stage_movements(p_stage, 16));
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
  SET num_weeks     = 12,
      days_per_week = 2,
      description =
        'A single-kettlebell alactic+aerobic conditioning protocol built on the '
        'one-arm clean & jerk. Every set is one bell on a 30-second interval - '
        'left hand on the minute, right hand 30 seconds later. Pick the bell you '
        'can clean & jerk 6-12 times with your WEAKER arm; long term the working '
        'weight settles near 40% of bodyweight for men. Train twice a week (the '
        'source prescribes Monday and Thursday). Duration is autoregulated, not '
        'scheduled: carry on until you cannot pass the talk test right before the '
        'next set - stop then, or at 30 minutes, whichever comes first. Progress '
        'by milestone, not calendar: once 30 minutes is repeatable with a clean '
        'talk test, add a second clean to each set (C+J+C), then a second jerk '
        '(C+J+C+J), up to three clean & jerks every 30 seconds. Every fourth week, '
        'deload one kettlebell size lighter (-8 kg gentlemen, -4 kg ladies) at the '
        'same cadence.'
  WHERE id = v_program_id;

  DELETE FROM program_sessions WHERE program_id = v_program_id;
  GET DIAGNOSTICS v_sessions_deleted = ROW_COUNT;

  INSERT INTO program_sessions
    (program_id, sequence_index, week_number, day_number, title, workout_options)
  VALUES
    -- Weeks 1-3: Stage 1, C+J
    (v_program_id,  0,  1, 1, 'C+J',            pg_temp.aa_refit_work(1)),
    (v_program_id,  1,  1, 2, 'C+J',            pg_temp.aa_refit_work(1)),
    (v_program_id,  2,  2, 1, 'C+J',            pg_temp.aa_refit_work(1)),
    (v_program_id,  3,  2, 2, 'C+J',            pg_temp.aa_refit_work(1)),
    (v_program_id,  4,  3, 1, 'C+J',            pg_temp.aa_refit_work(1)),
    (v_program_id,  5,  3, 2, 'C+J',            pg_temp.aa_refit_work(1)),
    -- Week 4: deload, Stage 1
    (v_program_id,  6,  4, 1, 'Deload · C+J',   pg_temp.aa_refit_deload(1)),
    (v_program_id,  7,  4, 2, 'Deload · C+J',   pg_temp.aa_refit_deload(1)),
    -- Weeks 5-7: Stage 2, C+J+C
    (v_program_id,  8,  5, 1, 'C+J+C',          pg_temp.aa_refit_work(2)),
    (v_program_id,  9,  5, 2, 'C+J+C',          pg_temp.aa_refit_work(2)),
    (v_program_id, 10,  6, 1, 'C+J+C',          pg_temp.aa_refit_work(2)),
    (v_program_id, 11,  6, 2, 'C+J+C',          pg_temp.aa_refit_work(2)),
    (v_program_id, 12,  7, 1, 'C+J+C',          pg_temp.aa_refit_work(2)),
    (v_program_id, 13,  7, 2, 'C+J+C',          pg_temp.aa_refit_work(2)),
    -- Week 8: deload, Stage 2
    (v_program_id, 14,  8, 1, 'Deload · C+J+C', pg_temp.aa_refit_deload(2)),
    (v_program_id, 15,  8, 2, 'Deload · C+J+C', pg_temp.aa_refit_deload(2)),
    -- Weeks 9-11: Stage 3, C+J+C+J
    (v_program_id, 16,  9, 1, 'C+J+C+J',          pg_temp.aa_refit_work(3)),
    (v_program_id, 17,  9, 2, 'C+J+C+J',          pg_temp.aa_refit_work(3)),
    (v_program_id, 18, 10, 1, 'C+J+C+J',          pg_temp.aa_refit_work(3)),
    (v_program_id, 19, 10, 2, 'C+J+C+J',          pg_temp.aa_refit_work(3)),
    (v_program_id, 20, 11, 1, 'C+J+C+J',          pg_temp.aa_refit_work(3)),
    (v_program_id, 21, 11, 2, 'C+J+C+J',          pg_temp.aa_refit_work(3)),
    -- Week 12: deload, Stage 3
    (v_program_id, 22, 12, 1, 'Deload · C+J+C+J', pg_temp.aa_refit_deload(3)),
    (v_program_id, 23, 12, 2, 'Deload · C+J+C+J', pg_temp.aa_refit_deload(3));
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
